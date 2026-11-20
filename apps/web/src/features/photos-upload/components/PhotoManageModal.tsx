'use client';

//사진 관리 모달: 수정 · 삭제 · 대표 변경을 모아 두었다가 저장 때 한 번에 보냄
//서버 값은 쿼리 캐시, 고친 값은 로컬 상태 (저장 전엔 캐시를 안 건드림)
//저장: PATCH /me/photos/batch 20개씩 순서대로, 대표는 첫 요청 (옛 대표 삭제와 같은 트랜잭션)
//성공한 묶음만 로컬에서 지움 → 실패하면 멈추고 남은 것만 다시 저장

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { usePhotographerPhotos } from '@/features/photos/hooks/usePhotographerPhotos';
import { queryKeys } from '@/lib/queryKeys';
import { getPhotoData, batchPhotos } from '../api';
import type {
  PhotoData,
  PhotoDetail,
  BatchRequest,
  BatchUpdate,
} from '../types';
import PhotoEditor from './PhotoEditor';
import type { EditorPreview } from './PhotoEditor';
import type { PhotoListItem } from './PhotoList';
import uploadStyles from './PhotoUploadModal.module.css';

type PhotoManageModalProps = {
  open: boolean;
  onClose: () => void;
  photographerId: string;
};

//서버 batch 제한 (수정 · 삭제 각각)
const MAX_BATCH = 20;

//대표는 끌 수 없음 (서버가 해제를 지원 안 함)
const REPRESENTATIVE_OFF_MESSAGE =
  '대표 이미지를 바꾸려면 다른 사진을 대표로 설정해 주세요.';

//다음 페이지 전에 마지막 1장을 지우면 대표가 비어서 막음
const REMOVE_BLOCKED_MESSAGE = '사진을 더 불러온 뒤 시도해주세요.';

//로그인 만료 판단 (업로드 모달과 같음)
const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐어요. 다시 로그인해 주세요.';
const isUnauthorized = (error: unknown) =>
  error instanceof Error &&
  (error.message === 'API 요청 실패: 401' ||
    error.message === '로그인이 필요한 요청입니다.');

//사진별 원본 + 수정본
type PhotoDraft = {
  original: PhotoDetail;
  edited: PhotoDetail;
};

//저장 결과 (성공한 id는 캐시 갱신용, 서버 응답엔 없음)
type SaveResult = {
  saved: number;
  updatedIds: string[];
  deletedIds: string[];
  error: unknown | null;
};

//서버 상세 → 폼 값 (description null → '')
function toDetail(data: PhotoData): PhotoDetail {
  return {
    categories: data.categories,
    styles: data.styles,
    keywords: data.keywords,
    description: data.description ?? '',
  };
}

const isSame = <T,>(o: T[], e: T[]) =>
  o.length === e.length && o.every((i) => e.includes(i));

const isSameWithOrder = <T,>(o: T[], e: T[]) =>
  o.length === e.length && o.every((i, index) => i === e[index]);

const isEdited = (draft: PhotoDraft) => {
  const { original: o, edited: e } = draft;
  return (
    !isSame(o.categories, e.categories) ||
    !isSame(o.styles, e.styles) ||
    !isSameWithOrder(o.keywords, e.keywords) ||
    o.description !== e.description
  );
};

export default function PhotoManageModal({
  open,
  onClose,
  photographerId,
}: PhotoManageModalProps) {
  const { fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = usePhotographerPhotos(open ? photographerId : undefined);
  const allPhotos = data?.pages.flatMap((page) => page.items) ?? [];

  const [drafts, setDrafts] = useState<Record<string, PhotoDraft>>({});
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [representativeId, setRepresentativeId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<SaveResult | null>(null);

  //삭제 대기는 화면에서만 숨김
  const visiblePhotos = allPhotos.filter((p) => !deleteIds.includes(p.photoId));
  const selected =
    visiblePhotos.find((p) => p.photoId === selectedId) ?? visiblePhotos[0];

  //지금 대표: 고른 사진 → 없으면 서버 값 (삭제 대기 제외)
  const currentRepresentativeId =
    representativeId ?? visiblePhotos.find((p) => p.isRepresentative)?.photoId;

  const detailQuery = useQuery({
    queryKey: queryKeys.photos.metadata(selected?.photoId ?? ''),
    queryFn: () => getPhotoData(selected!.photoId, fetchWithAuth),
    enabled: open && !!selected,
  });

  //고친 적 있으면 수정본, 아니면 서버 값
  const selectedDetail: PhotoDetail | null = selected
    ? (drafts[selected.photoId]?.edited ??
      (detailQuery.data ? toDetail(detailQuery.data) : null))
    : null;

  //바뀐 사진 (삭제할 사진은 빼기: 같이 보내면 400)
  const changedIds = Object.entries(drafts)
    .filter(([id, draft]) => isEdited(draft) && !deleteIds.includes(id))
    .map((item) => item[0]);

  const isDirty =
    changedIds.length > 0 || deleteIds.length > 0 || representativeId !== null;

  const hasMissingRequired = changedIds.some(
    (id) => drafts[id].edited.categories.length === 0,
  );

  function handleChange(patch: Partial<PhotoDetail>) {
    if (!selected || !selectedDetail) return;
    setDrafts((prev) => {
      const draft = prev[selected.photoId];
      const base = draft ? draft.original : { ...selectedDetail };
      const next = draft
        ? { ...draft.edited, ...patch }
        : { ...selectedDetail, ...patch };

      return {
        ...prev,
        [selected.photoId]: { original: base, edited: next },
      };
    });
  }

  function handleRepresentativeChange(on: boolean) {
    if (!on) {
      showToast(REPRESENTATIVE_OFF_MESSAGE, 'error');
      return;
    }
    if (selected) setRepresentativeId(selected.photoId);
  }

  function handleRemove(photoId: string) {
    if (hasNextPage && visiblePhotos.length === 1) {
      showToast(REMOVE_BLOCKED_MESSAGE, 'error');
      return;
    }
    setDeleteIds((prev) => [...prev, photoId]);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
    if (photoId === currentRepresentativeId) {
      setRepresentativeId(
        visiblePhotos.find((p) => p.photoId !== photoId)?.photoId ?? null,
      );
    }
    if (photoId === selectedId) setSelectedId(null);
  }

  function buildRequests(): BatchRequest[] {
    const edits = changedIds.map((id): BatchUpdate => ({
      photoId: id,
      ...drafts[id].edited,
      description: drafts[id].edited.description || null,
    }));
    const maxLength = Math.max(
      Math.ceil(edits.length / MAX_BATCH),
      Math.ceil(deleteIds.length / MAX_BATCH),
    );
    const finalLength = maxLength === 0 ? 1 : maxLength;
    return Array.from({ length: finalLength }, (_, i) => ({
      updates: edits.slice(i * MAX_BATCH, (i + 1) * MAX_BATCH),
      deletePhotoIds: deleteIds.slice(i * MAX_BATCH, (i + 1) * MAX_BATCH),
      ...(i === 0 &&
        representativeId && { representativePhotoId: representativeId }),
    }));
  }
  async function saveAll(): Promise<SaveResult> {
    const requests = buildRequests();
    let saved = 0;
    const updatedIds: string[] = [];
    const deletedIds: string[] = [];
    try {
      for (const request of requests) {
        await batchPhotos(request, fetchWithAuth);
        saved += 1;
        updatedIds.push(...request.updates.map((u) => u.photoId));
        deletedIds.push(...request.deletePhotoIds);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const item of request.updates) {
            delete next[item.photoId];
          }
          return next;
        });
        setDeleteIds((prev) =>
          prev.filter((id) => !request.deletePhotoIds.includes(id)),
        );
        if (request.representativePhotoId) setRepresentativeId(null);
      }
    } catch (error) {
      return { saved, updatedIds, deletedIds, error };
    }
    return { saved, updatedIds, deletedIds, error: null };
  }

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: saveAll,
    onSuccess: (result) => {
      if (result.saved > 0) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.photos.portfolioAll(),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.photos.feedAll(),
        });
        result.updatedIds.forEach((photoId) =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.photos.detailAll(photoId),
          }),
        );
        result.deletedIds.forEach((photoId) =>
          queryClient.removeQueries({
            queryKey: queryKeys.photos.detailAll(photoId),
          }),
        );
      }
      if (result.error === null) {
        quit();
      } else if (isUnauthorized(result.error)) {
        showToast(SESSION_EXPIRED_MESSAGE, 'error');
        quit();
      } else {
        setSaveError(result);
      }
    },
  });

  function reset() {
    setDrafts({});
    setDeleteIds([]);
    setRepresentativeId(null);
    setSelectedId(null);
    setConfirmOpen(false);
    setSaveError(null);
  }

  function quit() {
    reset();
    onClose();
  }

  function requestClose() {
    if (isDirty) setConfirmOpen(true);
    else quit();
  }

  const listItems: PhotoListItem[] = visiblePhotos.map((p, index) => ({
    localId: p.photoId,
    previewUrl: p.imageUrl,
    name: `사진 ${index + 1}`,
    missingRequired: drafts[p.photoId]?.edited.categories.length === 0,
    isRepresentative: p.photoId === currentRepresentativeId,
  }));

  //미리보기는 목록 값으로 바로 (깜빡임 방지), 파일명 · 용량은 서버에 없음
  const preview: EditorPreview | null = selected
    ? {
        previewUrl: selected.imageUrl,
        name:
          listItems.find((item) => item.localId === selected.photoId)?.name ??
          '선택한 사진',
        isRepresentative: selected.photoId === currentRepresentativeId,
      }
    : null;

  return (
    <>
      <Modal
        open={open}
        closeOnEscape={!isSaving}
        closeOnBackdrop={!isSaving}
        onClose={() => {
          //저장 중엔 닫기 무시
          if (isSaving) return;
          requestClose();
        }}
        title="포트폴리오 사진 관리"
        className={`${uploadStyles.surface} ${uploadStyles.step2}`}
      >
        <PhotoEditor
          photos={listItems}
          selectedId={selected?.photoId ?? null}
          onSelect={setSelectedId}
          onRemove={handleRemove}
          loadMore={{
            hasNextPage,
            isFetchingNextPage,
            isError: isFetchNextPageError,
            onLoadMore: fetchNextPage,
          }}
          preview={preview}
          detail={selectedDetail}
          detailError={detailQuery.isError}
          onRepresentativeChange={handleRepresentativeChange}
          onChange={handleChange}
          onSubmit={() => save()}
          submitLabel="업데이트하기"
          submittingLabel="업데이트 중…"
          submitDisabled={!isDirty || hasMissingRequired}
          isSubmitting={isSaving}
        />
      </Modal>

      {/* 아래 모달은 형제로 둬야 Esc·Tab이 그 안에서만 동작 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="저장하지 않고 나갈까요?"
        description="수정한 내용은 저장되지 않아요."
        variant="confirm"
        className={uploadStyles.confirm}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setConfirmOpen(false)}
            >
              계속 수정
            </Button>
            <Button size="md" onClick={quit}>
              나가기
            </Button>
          </>
        }
      />

      {saveError && (
        <Modal
          open
          onClose={() => setSaveError(null)}
          title="저장하지 못했어요"
          description={
            saveError.saved > 0
              ? '일부만 반영됐어요. 남은 내용을 다시 업데이트해 주세요.'
              : '잠시 후 다시 업데이트해 주세요.'
          }
          variant="confirm"
          className={uploadStyles.confirm}
          footer={
            <Button size="md" onClick={() => setSaveError(null)}>
              확인
            </Button>
          }
        />
      )}
    </>
  );
}
