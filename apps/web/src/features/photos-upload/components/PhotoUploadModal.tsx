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

//① 요청에 보낼 파일 정보
function toFileInfos(files: File[]): UploadFileInfo[] {
  return files.map((file) => ({
    fileName: file.name,
    contentType: file.type as ContentType,
    fileSize: file.size,
  }));
}

const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐어요. 다시 로그인해 주세요.';

const isUnauthorized = (error: unknown) =>
  error instanceof Error &&
  (error.message === 'API 요청 실패: 401' ||
    error.message === '로그인이 필요한 요청입니다.');

//사진 올리기 모달
//1단계: 파일 선택 → 형식 검증 → 중복 확인 → 리사이즈 → ① URL 발급 → ② S3 업로드 (실패하면 재시도)
//2단계: 정보 입력 → ③ 등록 → 결과 모달
//닫기: 사진이 있으면 확인창 → 업로드 중단 · 초기화
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
  //2단계에서 고른 사진 (없으면 첫 장)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [representativeId, setRepresentativeId] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState(false);
  //2단계 마지막 사진 빼기 확인 (null : 모달 닫힘)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  //중복 확인 중에 맡아 둔 선택 (null : 모달 닫힘)
  const [pendingFiles, setPendingFiles] = useState<{
    files: File[];
    duplicates: File[];
    messages: string[];
  } | null>(null);
  const photosRef = useRef(photos);
  //업로드 중단용
  const abortRef = useRef(new AbortController());
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  //언마운트: 미리보기 URL 해제 + 업로드 중단
  useEffect(() => {
    abortRef.current = new AbortController();
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      abortRef.current.abort();
    };
  }, []);

  //처리 중이거나 완료된 사진이 없으면 다음 막기
  const disabled =
    photos.some(
      (p) =>
        p.status === 'preparing' ||
        p.status === 'waiting' ||
        p.status === 'uploading',
    ) || photos.every((p) => !(p.status === 'uploaded'));

  //ids에 있는 사진만 덮어쓰기
  const patchPhotos = (ids: string[], patch: Partial<SelectedPhoto>) => {
    setPhotos((prev) =>
      prev.map((p) => (ids.includes(p.localId) ? { ...p, ...patch } : p)),
    );
  };

  //1단계: 파일 선택
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

    //중복처리
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

  //1단계: 업로드 시작
  async function startUpload(validFiles: File[], messages: string[] = []) {
    const signal = abortRef.current.signal;
    const message = [...messages];

    const leftInput = MAX_PHOTOS - photos.length;
    const acceptedFiles = validFiles.slice(0, leftInput);
    const droppedCount = validFiles.length - acceptedFiles.length;
    if (droppedCount > 0) {
      message.push(
        `사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요. ${droppedCount}장은 올리지 않았어요.`,
      );
    }
    setRejectMessages(message);
    const rejectedCount = messages.length + droppedCount;
    if (rejectedCount > 0) {
      showToast(`사진 ${rejectedCount}장을 추가하지 못했어요.`, 'error');
    }
    if (acceptedFiles.length === 0) return;
    //'준비 중'으로 먼저 띄움
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
    //한 장씩 리사이즈 → '대기 중'
    const prepared: SelectedPhoto[] = [];
    for (const photo of newPhotos) {
      const file = await resizeImage(photo.file).catch(() => photo.file);
      if (signal.aborted) {
        return;
      }

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
      if (previewUrl !== photo.previewUrl)
        URL.revokeObjectURL(photo.previewUrl);
    }
    const issued = await createUrl(prepared, signal);
    if (signal.aborted) return;

    //에러
    if (issued === 'unauthorized') {
      removePhotos(newPhotos);
      showToast(SESSION_EXPIRED_MESSAGE, 'error');
      return;
    }
    if (issued === 'failed') {
      patchPhotos(
        prepared.map(({ localId }) => localId),
        { status: 'failed' },
      );
    }
  }

  //1단계: 재시도 (항상 ①부터)
  async function handleRetry(targets: SelectedPhoto[]) {
    const signal = abortRef.current.signal;

    const ids = targets.map((p) => p.localId);
    patchPhotos(ids, { status: 'waiting', progress: 0 });
    const issued = await createUrl(targets, signal);
    if (signal.aborted) return;
    //에러
    if (issued !== 'ok') {
      patchPhotos(ids, { status: 'failed' });
      if (issued === 'unauthorized')
        showToast(SESSION_EXPIRED_MESSAGE, 'error');
    }
  }

  //1단계: ① URL 발급 → ② 업로드
  async function createUrl(
    newPhotos: SelectedPhoto[],
    signal: AbortSignal,
  ): Promise<IssueResult> {
    let items: UploadUrlItem[];
    const body: UploadUrlsRequest = {
      files: toFileInfos(newPhotos.map(({ file }) => file)),
      //동의해야 선택할 수 있어서 항상 true
      policyAgreed: true,
    };
    try {
      ({ items } = await createUploadUrls(body, fetchWithAuth));
    } catch (error) {
      return isUnauthorized(error) ? 'unauthorized' : 'failed';
    }
    //items와 newPhotos는 순서로 짝
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
        patchPhotos([localId], {
          uploadKey: item.uploadKey,
          status: 'uploaded',
        });
      } catch {
        //에러 (그만두기면 멈춤)
        if (signal?.aborted) break;
        patchPhotos([localId], { status: 'failed' });
      }
    }
    return 'ok';
  }

  //목록에서 빼고 미리보기 URL 해제
  function removePhotos(targets: SelectedPhoto[]) {
    const ids = targets.map((t) => t.localId);
    setPhotos((prev) => prev.filter((p) => !ids.includes(p.localId)));
    targets.forEach((t) => URL.revokeObjectURL(t.previewUrl));
  }

  //2단계: 정보 입력
  const editablePhotos = photos.filter((p) => p.status === 'uploaded');
  const selectedPhoto =
    editablePhotos.find((p) => p.localId === selectedId) ?? editablePhotos[0];

  function updateSelected(patch: Partial<PhotoDetail>) {
    if (!selectedPhoto) return;
    patchPhotos([selectedPhoto.localId], patch);
  }

  //2단계: ③ 등록
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
      //대표가 없으면 undefined → 요청에서 빠짐
      representativeUploadKey: editablePhotos.find(
        (p) => p.localId === representativeId,
      )?.uploadKey,
    };
    try {
      const { items, failed } = await registerPhotos(body, fetchWithAuth);

      //1장이라도 등록되면 갱신
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

      setResult({ kind: 'done', succeededCount: succeeded.length, failed });
    } catch (error) {
      //에러
      if (isUnauthorized(error)) {
        showToast(SESSION_EXPIRED_MESSAGE, 'error');
        return;
      }
      setResult({ kind: 'error' });
    } finally {
      setIsRegistering(false);
    }
  }

  //닫기
  const requestClose = () => {
    if (photos.length > 0) setConfirmOpen(true);
    else quit();
  };

  //그만두기
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

  //등록 결과 문구
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
          //등록 중엔 닫기 무시
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
              name: p.file.name,
              missingRequired: p.categories.length === 0,
              isRepresentative: p.localId === representativeId,
            }))}
            selectedId={selectedPhoto?.localId ?? null}
            onSelect={setSelectedId}
            onRemove={(id) => {
              //마지막 한 장이면 확인 모달
              if (editablePhotos.length === 1) {
                setPendingRemoveId(id);
              } else {
                removePhotos(photos.filter((p) => p.localId === id));
              }
            }}
            preview={
              selectedPhoto
                ? {
                    previewUrl: selectedPhoto.previewUrl,
                    name: selectedPhoto.file.name,
                    fileName: selectedPhoto.file.name,
                    fileSize: selectedPhoto.file.size,
                    isRepresentative:
                      selectedPhoto.localId === representativeId,
                  }
                : null
            }
            detail={
              selectedPhoto
                ? {
                    categories: selectedPhoto.categories,
                    styles: selectedPhoto.styles,
                    keywords: selectedPhoto.keywords,
                    description: selectedPhoto.description,
                  }
                : null
            }
            //켜면 이 사진, 끄면 대표 없음
            onRepresentativeChange={(on) =>
              setRepresentativeId(
                on && selectedPhoto ? selectedPhoto.localId : null,
              )
            }
            onChange={updateSelected}
            onPrev={() => setStep(1)}
            onSubmit={handleRegister}
            submitLabel={`${editablePhotos.length}장 등록하기`}
            submittingLabel="등록 중…"
            //0장이거나 카테고리 빈 사진이 있으면 막기
            submitDisabled={
              editablePhotos.length === 0 ||
              editablePhotos.some((p) => p.categories.length === 0)
            }
            isSubmitting={isRegistering}
          />
        )}
      </Modal>

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

      {/* 중복 사진 */}
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

      {/* 2단계 마지막 사진 빼기 → 1단계로 */}
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

      {/* 등록 전체 실패 */}
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

      {/* 등록 결과 */}
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
