'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { createUploadUrls, putFileToUploadUrl, registerPhotos } from '../api';
import { resizeImage } from '../resize';
import { MAX_PHOTOS, validateFile, toSourceKey } from '../validation';
import type {
  ContentType,
  IssueResult,
  PhotoDetail,
  RegisterResult,
  SelectedPhoto,
  UploadFileInfo,
  UploadUrlItem,
  UploadUrlsRequest,
  RegisterPhotosRequest,
} from '../types';
import PhotoUploader from './PhotoUploader';
import PhotoEditor from './PhotoEditor';
import styles from './PhotoUploadModal.module.css';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

type UploadModalStep = 1 | 2;

type PhotoUploadModalProps = {
  open: boolean;
  onClose: () => void;
};

const STEPS: { step: UploadModalStep; label: string }[] = [
  { step: 1, label: '사진 올리기' },
  { step: 2, label: '정보 입력' },
];

//① 요청 본문용 파일 정보
function toFileInfos(files: File[]): UploadFileInfo[] {
  return files.map((file) => ({
    fileName: file.name,
    contentType: file.type as ContentType,
    fileSize: file.size,
  }));
}

//로그인 만료 토스트 (①·재시도·③ 공통)
const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐어요. 다시 로그인해 주세요.';

//로그인 만료: 첫 401(재발급 실패) 이후에는 토큰이 지워져 메시지가 바뀐다
//TODO(공용 에러): 메시지 문자열 비교 대신 status 기반으로 교체
const isUnauthorized = (error: unknown) =>
  error instanceof Error &&
  (error.message === 'API 요청 실패: 401' ||
    error.message === '로그인이 필요한 요청입니다.');

//사진 올리기 모달: 단계·업로드 상태 관리, 1단계 PhotoUploader / 2단계 PhotoEditor
//TODO(백엔드): 등록 취소 API 요청 — staging 등록 시간 재보고 판단
//TODO(공용 Modal): ESC 연타하면 강제로 닫힘 — 팀원 수정 후 잠금 prop으로
//TODO: 미리보기 교체 때 깜빡임 — img.decode() 후 교체
export default function PhotoUploadModal({
  open,
  onClose,
}: PhotoUploadModalProps) {
  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<UploadModalStep>(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [rejectMessages, setRejectMessages] = useState<string[]>([]);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  //2단계에서 편집 중인 사진 (없으면 첫 장)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [representativeId, setRepresentativeId] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState(false);
  //2단계 마지막 사진 빼기 확인 중인 사진 (null이면 모달 닫힘)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  //중복 확인 모달이 떠 있는 동안 맡아 둔 선택 (null이면 모달 닫힘)
  const [pendingFiles, setPendingFiles] = useState<{
    files: File[];
    duplicates: File[];
    messages: string[];
  } | null>(null);
  const photosRef = useRef(photos);
  //업로드 중단용, 그만두기 때 abort 후 새 것으로 교체
  const abortRef = useRef(new AbortController());
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  //quit 없이 앱 안에서 페이지를 떠날 때: 미리보기 URL 해제 + 업로드 중단
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      abortRef.current.abort();
    };
  }, []);

  //다음 막기: 처리 중인 사진이 있거나 완료된 사진이 없을 때 (0장 포함)
  const disabled =
    photos.some(
      (p) =>
        p.status === 'preparing' ||
        p.status === 'waiting' ||
        p.status === 'uploading',
    ) || photos.every((p) => !(p.status === 'uploaded'));

  //ids에 있는 사진만 patch로 덮어씀 (사진 갱신은 모두 여기로)
  //이전 값에 따라 달라지는 갱신은 못 함 → setPhotos(prev => …) 직접
  const patchPhotos = (ids: string[], patch: Partial<SelectedPhoto>) => {
    setPhotos((prev) =>
      prev.map((p) => (ids.includes(p.localId) ? { ...p, ...patch } : p)),
    );
  };

  // ── 1단계: 선택 → 전처리 → ① URL 발급 → ② 업로드 ──
  //파일 선택: 형식 검증 → 중복 확인 → 업로드 시작
  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);

    input.value = '';
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const messages: string[] = [];
    for (const file of files) {
      const fileCheck = validateFile(file);
      if (fileCheck) messages.push(`${file.name}: ${fileCheck}`);
      else validFiles.push(file);
    }

    //목록에 같은 원본이 있으면 모달로 묻고 멈춤, 없으면 바로 업로드
    const sourceKeys = new Set(photos.map((p) => p.sourceKey));
    const duplicates = validFiles.filter((file) =>
      sourceKeys.has(toSourceKey(file)),
    );
    if (duplicates.length > 0) {
      setPendingFiles({ files: validFiles, duplicates, messages });
      return;
    }
    await startUpload(validFiles, messages);
  }

  //업로드 시작: 20장 자르기 → 목록 추가 → 리사이즈 → ① → ②
  //messages: 형식 검증 안내, 덮어쓰지 않게 받아서 이어 붙임
  async function startUpload(validFiles: File[], messages: string[] = []) {
    //이번 업로드의 중단 신호 (시작 시점 것을 끝까지 씀)
    const signal = abortRef.current.signal;
    const message = [...messages];

    //남은 자리만큼만 받음 (모달 전체 MAX_PHOTOS장, 상태 무관)
    const leftInput = MAX_PHOTOS - photos.length;
    const acceptedFiles = validFiles.slice(0, leftInput);
    const droppedCount = validFiles.length - acceptedFiles.length;
    if (droppedCount > 0) {
      message.push(
        `사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요. ${droppedCount}장은 올리지 않았어요.`,
      );
    }
    setRejectMessages(message);
    if (acceptedFiles.length === 0) return;
    //목록에 '준비 중'으로 먼저 띄움 (미리보기는 원본으로 바로)
    const newPhotos: SelectedPhoto[] = acceptedFiles.map((file) => ({
      file,
      sourceKey: toSourceKey(file),
      previewUrl: URL.createObjectURL(file),
      localId: crypto.randomUUID(),
      status: 'preparing',
      progress: 0,
      categories: [],
      styles: [],
      keywords: [],
      description: '',
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    //한 장씩 리사이즈 → '대기 중' (①에는 state 말고 prepared를 넘김)
    const prepared: SelectedPhoto[] = [];
    for (const photo of newPhotos) {
      const file = await resizeImage(photo.file).catch(() => photo.file);
      if (signal.aborted) {
        return;
      }

      //리사이즈됐으면 미리보기도 교체 (원본 디코딩 부담 줄이기)
      const previewUrl =
        file !== photo.file ? URL.createObjectURL(file) : photo.previewUrl;

      const ready: SelectedPhoto = {
        ...photo,
        file,
        previewUrl,
        status: 'waiting',
      };
      prepared.push(ready);
      patchPhotos([photo.localId], { file, previewUrl, status: 'waiting' });
      //교체했으면 원본 URL 해제
      if (previewUrl !== photo.previewUrl)
        URL.revokeObjectURL(photo.previewUrl);
    }
    const issued = await createUrl(prepared, signal);
    if (signal.aborted) return;

    //401: 재시도해도 소용없음 → 이번 사진 빼고 토스트
    if (issued === 'unauthorized') {
      removePhotos(newPhotos);
      showToast(SESSION_EXPIRED_MESSAGE, 'error');
      return;
    }
    //네트워크·서버: failed로 남기고 재시도
    if (issued === 'failed') {
      patchPhotos(
        prepared.map(({ localId }) => localId),
        { status: 'failed' },
      );
    }
  }

  //재시도: 한 장 / 실패 전부 / 다시 올리기 — 항상 ①부터 (새 URL이라 만료 걱정 없음)
  //바로 waiting으로 바꿔 연타 막기
  async function handleRetry(targets: SelectedPhoto[]) {
    const signal = abortRef.current.signal;

    const ids = targets.map((p) => p.localId);
    patchPhotos(ids, { status: 'waiting', progress: 0 });
    const issued = await createUrl(targets, signal);
    if (signal.aborted) return;
    //① 실패: failed로 되돌림 (401이면 토스트도)
    if (issued !== 'ok') {
      patchPhotos(ids, { status: 'failed' });
      if (issued === 'unauthorized')
        showToast(SESSION_EXPIRED_MESSAGE, 'error');
    }
  }

  //① URL 발급 → ② 한 장씩 PUT
  //반환값은 ①의 결과 ('ok' | 'failed' | 'unauthorized'), 처리는 부른 쪽에서
  async function createUrl(
    newPhotos: SelectedPhoto[],
    signal: AbortSignal,
  ): Promise<IssueResult> {
    let items: UploadUrlItem[];
    const body: UploadUrlsRequest = {
      files: toFileInfos(newPhotos.map(({ file }) => file)),
      //선택은 동의 후에만 열리고 등록은 다음을 거쳐야 해서 항상 true (재시도 포함)
      policyAgreed: true,
    };
    try {
      ({ items } = await createUploadUrls(body, fetchWithAuth));
    } catch (error) {
      return isUnauthorized(error) ? 'unauthorized' : 'failed';
    }
    //items[i]와 newPhotos[i]는 순서로 짝 (서버가 순서 보장)
    for (const [i, item] of items.entries()) {
      const { localId, file } = newPhotos[i];
      patchPhotos([localId], { status: 'uploading' });
      try {
        await putFileToUploadUrl(
          item.uploadUrl,
          file,
          (progress) => patchPhotos([localId], { progress }),
          signal,
        );
        //PUT이 끝난 뒤에만 성공 처리
        patchPhotos([localId], {
          uploadKey: item.uploadKey,
          status: 'uploaded',
        });
      } catch {
        //그만두기면 남은 사진도 멈춤 (실패 표시 안 함)
        if (signal?.aborted) break;
        //이 사진만 실패, 나머지는 계속
        patchPhotos([localId], { status: 'failed' });
      }
    }
    return 'ok';
  }

  //목록에서 빼고 미리보기 URL 해제 (한 장·401·등록 성공·그만두기)
  function removePhotos(targets: SelectedPhoto[]) {
    const ids = targets.map((t) => t.localId);
    setPhotos((prev) => prev.filter((p) => !ids.includes(p.localId)));
    targets.forEach((t) => URL.revokeObjectURL(t.previewUrl));
  }

  // ── 2단계: 정보 입력 ──
  //2단계에는 완료된 사진만
  const editablePhotos = photos.filter((p) => p.status === 'uploaded');
  const selectedPhoto =
    editablePhotos.find((p) => p.localId === selectedId) ?? editablePhotos[0];

  //선택한 사진의 입력정보 수정
  function updateSelected(patch: Partial<PhotoDetail>) {
    if (!selectedPhoto) return;
    patchPhotos([selectedPhoto.localId], patch);
  }

  //③ 등록: 완료된 사진만 보냄
  //전체 실패(서버·네트워크): 등록 안 됨 → 같은 사진으로 다시 등록
  //일부 실패(201 안 failed[]): 성공한 것만 빼고 결과 모달 → 다시 올리기(①부터)
  async function handleRegister() {
    setIsRegistering(true);
    const body: RegisterPhotosRequest = {
      items: editablePhotos.map((p) => ({
        uploadKey: p.uploadKey!,
        categories: p.categories,
        styles: p.styles,
        keywords: p.keywords,
        description: p.description || null, //'' → null
      })),
      //대표 안 켰거나 그 사진을 뺐으면 undefined → 요청에서 빠짐
      representativeUploadKey: editablePhotos.find(
        (p) => p.localId === representativeId,
      )?.uploadKey,
    };
    try {
      const { items, failed } = await registerPhotos(body, fetchWithAuth);

      //1장이라도 등록되면 포트폴리오·피드 다시 불러오기
      if (items.length > 0) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.photos.portfolioAll(),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.photos.feedAll(),
        });
      }
      const succeeded = photos.filter((p) =>
        items.some((item) => item.uploadKey === p.uploadKey),
      );
      removePhotos(succeeded);

      //목록에는 실패한 사진만 남음
      setResult({ kind: 'done', succeededCount: succeeded.length, failed });
    } catch (error) {
      if (isUnauthorized(error)) {
        showToast(SESSION_EXPIRED_MESSAGE, 'error');
        return;
      }
      setResult({ kind: 'error' });
    } finally {
      setIsRegistering(false);
    }
  }

  // ── 닫기 ──

  //✕·Esc·배경·취소: 사진 있으면 확인창, 없으면 바로 닫기
  const requestClose = () => {
    if (photos.length > 0) setConfirmOpen(true);
    else quit();
  };

  //그만두기: 업로드 중단 → 상태 초기화 → 닫기
  const quit = () => {
    abortRef.current.abort();
    abortRef.current = new AbortController();
    removePhotos(photos);
    setRejectMessages([]);
    setResult(null);
    setConfirmOpen(false);
    setStep(1);
    setPolicyAgreed(false);
    setSelectedId(null);
    setRepresentativeId(null);
    setPolicyError(false);
    setPendingFiles(null);
    onClose();
  };

  //등록 결과 문구: 전부 성공 / 일부 실패 / 전부 실패, 있는 문장만 이어 붙임
  let resultTitle = '';
  let resultDescription = '';
  if (result?.kind === 'done') {
    resultTitle = result.succeededCount > 0 ? '업로드 성공' : '업로드 실패';
    resultDescription = [
      result.succeededCount > 0 && `${result.succeededCount}장을 올렸어요.`,
      result.failed.length > 0 &&
        `${result.failed.length}장을 올리지 못했어요.`,
    ]
      .filter(Boolean)
      .join(' ');
  }
  const registerDone = result?.kind === 'done' && result.failed.length === 0;

  return (
    <>
      <Modal
        open={open && !registerDone}
        closeOnEscape={!isRegistering}
        closeOnBackdrop={!isRegistering}
        onClose={() => {
          //등록 중엔 닫기 무시 (서버 처리는 못 멈춤)
          if (isRegistering) {
            return;
          }
          requestClose();
        }}
        title="포트폴리오 사진 올리기"
        className={`${styles.surface} ${step === 1 ? styles.step1 : styles.step2}`}
      >
        <ol className={styles.stepper}>
          {STEPS.map((item) => {
            const state =
              item.step === step
                ? 'current'
                : item.step < step
                  ? 'done'
                  : 'todo';
            return (
              <li
                key={item.step}
                className={styles.stepItem}
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className={styles.stepNum} aria-hidden="true">
                  {state === 'done' ? '✓' : item.step}
                </span>
                {item.label}
                {state === 'done' && (
                  <span className={styles.visuallyHidden}> (완료)</span>
                )}
              </li>
            );
          })}
        </ol>

        {step === 1 ? (
          <PhotoUploader
            policyAgreed={policyAgreed}
            policyError={policyError}
            onPolicyAgreedChange={(agreed) => {
              setPolicyAgreed(agreed);
              if (agreed) setPolicyError(false);
            }}
            onFilesChange={(e) => {
              uploadFiles(e);
            }}
            rejectMessages={rejectMessages}
            photos={photos}
            onRemove={(id) =>
              removePhotos(photos.filter((p) => p.localId === id))
            }
            onRetry={(id) =>
              handleRetry(photos.filter((p) => p.localId === id))
            }
            onRetryAll={() => {
              handleRetry(photos.filter((p) => p.status === 'failed'));
            }}
            onCancel={requestClose}
            onNext={() => {
              if (!policyAgreed) {
                setPolicyError(true);
                return;
              }
              setStep(2);
            }}
            nextDisabled={disabled}
          />
        ) : (
          <PhotoEditor
            photos={editablePhotos.map((p) => ({
              localId: p.localId,
              previewUrl: p.previewUrl,
              fileName: p.file.name,
              //카테고리 비면 썸네일에 빨간 점
              missingRequired: p.categories.length === 0,
            }))}
            selectedId={selectedPhoto?.localId ?? null}
            onSelect={setSelectedId}
            onRemove={(id) => {
              //마지막 한 장이면 확인 모달 (빼면 1단계로)
              if (editablePhotos.length === 1) {
                setPendingRemoveId(id);
              } else {
                removePhotos(photos.filter((p) => p.localId === id));
              }
            }}
            current={
              selectedPhoto
                ? {
                    previewUrl: selectedPhoto.previewUrl,
                    fileName: selectedPhoto.file.name,
                    fileSize: selectedPhoto.file.size,
                    isRepresentative:
                      selectedPhoto.localId === representativeId,
                    categories: selectedPhoto.categories,
                    styles: selectedPhoto.styles,
                    keywords: selectedPhoto.keywords,
                    description: selectedPhoto.description,
                  }
                : null
            }
            //켜면 이 사진으로 교체, 끄면 대표 없음
            onRepresentativeChange={(on) =>
              setRepresentativeId(
                on && selectedPhoto ? selectedPhoto.localId : null,
              )
            }
            onChange={updateSelected}
            onPrev={() => setStep(1)}
            onSubmit={handleRegister}
            //0장이거나 카테고리 빈 사진이 있으면 등록 막기
            submitDisabled={
              editablePhotos.length === 0 ||
              editablePhotos.some((p) => p.categories.length === 0)
            }
            isSubmitting={isRegistering}
          />
        )}
      </Modal>

      {/* 아래 모달들은 형제로 둬야 Esc·Tab이 그 모달 안에서만 처리됨 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="업로드를 그만둘까요?"
        description="올리던 사진은 저장되지 않아요."
        variant="confirm"
        className={styles.confirm}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setConfirmOpen(false)}
            >
              계속 올리기
            </Button>
            <Button size="md" onClick={quit}>
              그만두기
            </Button>
          </>
        }
      />

      {/* 중복 사진: 건너뛰기 / 그래도 추가, 닫기는 이번 선택 취소 */}
      <Modal
        open={pendingFiles !== null}
        onClose={() => setPendingFiles(null)}
        title="이미 추가한 사진이 있어요"
        description={`선택한 사진 중 ${pendingFiles?.duplicates.length ?? 0}장이 목록에 있는 사진과 같아요.`}
        variant="confirm"
        className={styles.confirm}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                if (!pendingFiles) return;
                startUpload(pendingFiles?.files, pendingFiles.messages);
                setPendingFiles(null);
              }}
            >
              그래도 추가
            </Button>
            <Button
              size="md"
              onClick={() => {
                if (pendingFiles === null) return;
                const { files, duplicates } = pendingFiles;
                startUpload(
                  files.filter((f) => !duplicates.includes(f)),
                  pendingFiles.messages,
                );
                setPendingFiles(null);
              }}
            >
              건너뛰기
            </Button>
          </>
        }
      >
        <ul className={styles.duplicateList}>
          {pendingFiles?.duplicates.map((file) => (
            <li key={toSourceKey(file)}>{file.name}</li>
          ))}
        </ul>
      </Modal>

      {/* 2단계 마지막 사진 빼기: 확인하면 빼고 1단계로 */}
      <Modal
        open={pendingRemoveId !== null}
        onClose={() => {
          setPendingRemoveId(null);
        }}
        title="마지막 사진을 지울까요?"
        description="사진이 없으면 이전 단계로 돌아가요."
        variant="confirm"
        className={styles.confirm}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setPendingRemoveId(null);
              }}
            >
              취소
            </Button>
            <Button
              size="md"
              onClick={() => {
                removePhotos(
                  photos.filter((p) => p.localId === pendingRemoveId),
                );
                setStep(1);
                setSelectedId(null);
                setPendingRemoveId(null);
              }}
            >
              빼고 돌아가기
            </Button>
          </>
        }
      />

      {/* 등록 전체 실패: 닫으면 2단계에 남아 다시 등록 */}
      {result?.kind === 'error' && (
        <Modal
          open
          onClose={() => setResult(null)}
          title="사진을 등록하지 못했어요"
          description="잠시 후 다시 등록해 주세요."
          variant="confirm"
          className={styles.confirm}
          footer={
            <Button size="md" onClick={() => setResult(null)}>
              확인
            </Button>
          }
        />
      )}

      {/* 등록 결과: 전부 성공이면 확인, 실패 있으면 그만두기 / 다시 올리기 */}
      {result?.kind === 'done' && (
        <Modal
          open
          onClose={quit}
          title={resultTitle}
          description={resultDescription}
          variant="confirm"
          className={styles.confirm}
          footer={
            result.failed.length > 0 ? (
              <>
                <Button variant="outline" size="md" onClick={quit}>
                  그만두기
                </Button>
                <Button
                  size="md"
                  onClick={() => {
                    setResult(null);
                    setStep(1);
                    handleRetry(photos);
                  }}
                >
                  다시 올리기
                </Button>
              </>
            ) : (
              <Button size="md" onClick={quit}>
                확인
              </Button>
            )
          }
        />
      )}
    </>
  );
}
