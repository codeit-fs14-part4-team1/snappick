'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { createUploadUrls, putFileToUploadUrl, registerPhotos } from '../api';
import { resizeImage } from '../resize';
import { validateFile } from '../validation';
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

// 사진 올리기 모달 (최상위): 단계·업로드 상태를 관리하고 1단계 PhotoUploader / 2단계 PhotoEditor를 그린다
//TODO(Phase 2)
// - 중복 파일: name+size+lastModified로 판단, 건너뛰기/그래도 추가를 한 번에 묻기 (정책 확정 필요)
// - 전부 재시도 버튼: handleRetry(photos.filter(failed))
// - 재시도 중 ① 실패는 안내 없이 failed로만 돌아간다
// - URL 만료(10분) 시 ①부터 다시
// - 빼기·그만두기 때 진행 중인 업로드 중단(abort): 지금은 끝까지 올라가고 임시 파일은 수명 주기 규칙이 정리
export default function PhotoUploadModal({
  open,
  onClose,
}: PhotoUploadModalProps) {
  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<UploadModalStep>(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [rejectMessages, setRejectMessages] = useState<string[]>([]);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  //2단계에서 오른쪽 폼으로 편집 중인 사진 (없으면 첫 장)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [representativeId, setRepresentativeId] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState(false);
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  //quit 없이 앱 안에서 페이지를 떠날 때 미리보기 URL 정리 (닫기는 quit, 문서 이동은 브라우저가 해제)
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  //진행 중인 사진이 있거나, 등록할(완료된) 사진이 없으면 다음을 막는다
  const disabled =
    photos.some(
      (p) =>
        p.status === 'preparing' ||
        p.status === 'waiting' ||
        p.status === 'uploading',
    ) || photos.every((p) => !(p.status === 'uploaded'));

  //localId가 ids에 있는 사진만 patch로 덮어쓴다 (사진 갱신은 모두 여기로)
  //이전 값에 따라 달라지는 갱신은 여기서 못 한다 → 필요하면 setPhotos(prev => …) 직접
  const patchPhotos = (ids: string[], patch: Partial<SelectedPhoto>) => {
    setPhotos((prev) =>
      prev.map((p) => (ids.includes(p.localId) ? { ...p, ...patch } : p)),
    );
  };

  // ── 1단계: 선택 → 전처리 → ① URL 발급 → ② 업로드 ──

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);

    input.value = '';
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const message: string[] = [];
    for (const file of files) {
      const fileCheck = validateFile(file);
      if (fileCheck) message.push(`${file.name}: ${fileCheck}`);
      else validFiles.push(file);
    }
    setRejectMessages(message);
    if (validFiles.length === 0) return;

    //검증 통과: 목록에 '준비 중'으로 먼저 띄운다
    const newPhotos: SelectedPhoto[] = validFiles.map((file) => ({
      file,
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
    //한 장씩 리사이즈 → '대기 중' (①에는 state가 아니라 prepared 배열을 넘긴다)
    const prepared: SelectedPhoto[] = [];
    for (const photo of newPhotos) {
      const file = await resizeImage(photo.file).catch(() => photo.file);
      const ready: SelectedPhoto = { ...photo, file, status: 'waiting' };
      prepared.push(ready);
      patchPhotos([photo.localId], { file, status: 'waiting' });
    }
    const issued = await createUrl(prepared);
    //① 실패(일반·로그인 만료): 이번에 고른 사진만 빼고 안내
    if (issued !== 'ok') {
      removePhotos(newPhotos);
      if (issued === 'unauthorized') {
        showToast(SESSION_EXPIRED_MESSAGE, 'error');
        return;
      }
      setRejectMessages(['사진을 다시 선택해 주세요.']);
    }
  }

  //① URL 발급 → ② 한 장씩 PUT
  //반환값: 'ok' | 'failed' | 'unauthorized'(로그인 만료) — ①의 결과, 처리는 호출한 쪽이 정한다
  //②의 개별 실패는 사진별 failed로 표시하고 나머지는 계속 진행
  async function createUrl(newPhotos: SelectedPhoto[]): Promise<IssueResult> {
    let items: UploadUrlItem[];
    const body: UploadUrlsRequest = {
      files: toFileInfos(newPhotos.map(({ file }) => file)),
      //재시도에는 true로 두고 다음버튼을 통해서만 정책동의 여부 체크
      policyAgreed: true,
    };
    try {
      ({ items } = await createUploadUrls(body, fetchWithAuth));
    } catch (error) {
      return isUnauthorized(error) ? 'unauthorized' : 'failed';
    }
    //items[i]와 newPhotos[i]는 이번 요청 안에서만 순서로 짝이 맞는다 (서버가 순서 보장)
    for (const [i, item] of items.entries()) {
      const { localId, file } = newPhotos[i];
      patchPhotos([localId], { status: 'uploading' });
      try {
        await putFileToUploadUrl(item.uploadUrl, file, (progress) =>
          patchPhotos([localId], { progress }),
        );
        //PUT이 끝난 뒤에만 성공 처리
        patchPhotos([localId], {
          uploadKey: item.uploadKey,
          status: 'uploaded',
        });
      } catch {
        //이 사진만 실패, 나머지는 계속 진행
        patchPhotos([localId], { status: 'failed' });
      }
    }
    return 'ok';
  }

  //재시도: 한 장이면 [photo], 다시 올리기면 남은 사진 전부
  //바로 waiting으로 바꿔 연타를 막고, ①부터 다시 한다 (새 URL이라 만료 걱정 없음)
  async function handleRetry(targets: SelectedPhoto[]) {
    const ids = targets.map((p) => p.localId);
    patchPhotos(ids, { status: 'waiting', progress: 0 });
    const issued = await createUrl(targets);
    //① 실패: 목록에서 빼지 않고 failed로 되돌린다 (로그인 만료면 안내도)
    if (issued !== 'ok') {
      patchPhotos(ids, { status: 'failed' });
      if (issued === 'unauthorized')
        showToast(SESSION_EXPIRED_MESSAGE, 'error');
    }
  }

  //목록에서 빼고 미리보기 URL을 푼다 (localId 기준)
  //한 장이면 [photo], ① 실패면 newPhotos, 등록 성공이면 성공한 사진, 그만두기면 photos 전부
  function removePhotos(targets: SelectedPhoto[]) {
    const ids = targets.map((t) => t.localId);
    setPhotos((prev) => prev.filter((p) => !ids.includes(p.localId)));
    targets.forEach((t) => URL.revokeObjectURL(t.previewUrl));
  }

  // ── 2단계: 정보 입력 ──
  //2단계에는 업로드 완료된 사진만 넘어온다
  const editablePhotos = photos.filter((p) => p.status === 'uploaded');
  const selectedPhoto =
    editablePhotos.find((p) => p.localId === selectedId) ?? editablePhotos[0];

  //선택한 사진의 입력정보 수정
  function updateSelected(patch: Partial<PhotoDetail>) {
    if (!selectedPhoto) return;
    patchPhotos([selectedPhoto.localId], patch);
  }

  //③ 등록: 업로드 완료(uploaded)된 사진만 보낸다
  //전체 실패(catch, 서버·네트워크): 아무것도 등록되지 않음 → 같은 사진으로 다시 등록(③만)
  //파일 실패(failed[], 201 응답 안): 성공한 사진만 목록에서 빼고 결과 모달 → 다시 올리기(①부터)
  async function handleRegister() {
    setIsRegistering(true);
    const body: RegisterPhotosRequest = {
      items: editablePhotos.map((p) => ({
        uploadKey: p.uploadKey!,
        categories: p.categories,
        styles: p.styles,
        keywords: p.keywords,
        description: p.description || null, //입력 안 하면 '' → 서버는 null
      })),
      //대표를 안 켰거나 그 사진을 뺐으면 undefined → 요청에서 빠진다
      representativeUploadKey: editablePhotos.find(
        (p) => p.localId === representativeId,
      )?.uploadKey,
    };
    try {
      const { items, failed } = await registerPhotos(body, fetchWithAuth);
      const succeeded = photos.filter((p) =>
        items.some((item) => item.uploadKey === p.uploadKey),
      );
      removePhotos(succeeded);

      //목록에는 실패한 사진만 남는다 (다시 올리기 → 1단계에서 ①부터)
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

  //✕·Esc·배경 클릭·취소: 사진이 있으면 확인창, 없으면 바로 닫기
  const requestClose = () => {
    if (photos.length > 0) setConfirmOpen(true);
    else quit();
  };

  //그만두기: 상태를 처음으로 되돌리고 닫는다
  const quit = () => {
    removePhotos(photos);
    setRejectMessages([]);
    setResult(null);
    setConfirmOpen(false);
    setStep(1);
    setPolicyAgreed(false);
    setSelectedId(null);
    setRepresentativeId(null);
    setPolicyError(false);
    onClose();
  };

  //등록 결과 문구: 전부 성공 / 일부 실패 / 전부 실패(파일 문제), 설명은 있는 문장만 이어 붙인다
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
        onClose={requestClose}
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
            onCancel={requestClose}
            onNext={() => {
              if (!policyAgreed) {
                setPolicyError(true);
                return;
              }
              setStep(2);
            }}
            nextDisabled={photos.length === 0 || disabled}
          />
        ) : (
          <PhotoEditor
            photos={editablePhotos.map((p) => ({
              localId: p.localId,
              previewUrl: p.previewUrl,
              fileName: p.file.name,
              //필수(카테고리)가 비면 썸네일에 빨간 점
              missingRequired: p.categories.length === 0,
            }))}
            selectedId={selectedPhoto?.localId ?? null}
            onSelect={setSelectedId}
            onRemove={(id) =>
              removePhotos(photos.filter((p) => p.localId === id))
            }
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
            //카테고리가 빈 사진이 하나라도 있으면 등록을 막는다
            submitDisabled={editablePhotos.some(
              (p) => p.categories.length === 0,
            )}
            isSubmitting={isRegistering}
          />
        )}
      </Modal>

      {/* 아래 모달들은 위 모달과 형제로 두어야 Esc·Tab이 그 모달 안에서만 처리된다 */}
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

      {/* 등록 전체 실패(서버·네트워크): 닫으면 2단계에 남아 다시 등록 */}
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

      {/* 등록 결과: 전부 성공이면 확인(닫기), 파일 실패가 있으면 그만두기/다시 올리기 */}
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
                {/* 남은 photos는 실패한 사진뿐 → 1단계에서 ①부터 다시 */}
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
