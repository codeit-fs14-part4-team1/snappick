'use client';

//사진 관리 모달: 내 포트폴리오 사진 수정 · 삭제 · 대표 변경을 모아 두었다가 저장 때 한 번에 보냄
//
//목록
// GET /photographers/:photographerId/photos (usePhotographerPhotos, 프로필과 캐시 공유) 최신순 20장 + 무한 스크롤
// 처음엔 첫 장 선택, 사진을 고르면 GET /me/photos/:photoId로 상세를 불러와 오른쪽 폼에 채움
// 한 번 불러온 상세는 쿼리 캐시에 남음 (다시 골라도 요청 안 함)
//
//정보는 두 겹
// 서버 원본 = 쿼리 캐시 / 내가 고친 값 = 이 모달의 로컬 상태 (drafts · deleteIds · representativeId)
// 저장 전엔 캐시를 건드리지 않음 (프로필과 같이 쓰고, 취소하면 되돌릴 기준이 없어서)
//
//저장 버튼
// 바뀐 게 없으면 비활성 (서버도 셋 다 비면 400) → ✕로 그냥 닫힘
// 고친 사진은 카테고리 1개 이상이어야 활성 (안 연 사진은 서버 값 그대로라 검사 안 함)
// 바뀐 게 있는데 닫으면 "저장 안 하고 나갈까요?" 확인
//
//예외
// 수정 후 삭제한 사진은 updates에서 뺌 (같이 보내면 400 CONFLICTING_PHOTO_ACTION)
// 대표 사진을 지우면 남은 사진 중 첫 장을 대표로 (삭제 대상을 대표로 보내면 400)
// 전부 지우면 0장 허용 → 대표 없이 보냄 (cascade로 대표도 사라짐, 빈 포트폴리오)
//
//저장: PATCH /me/photos/batch, updates · deletes 각각 20개 제한 → 20개씩 잘라 같은 순번끼리 한 요청
// for...of로 순서대로, 대표는 첫 요청에 (옛 대표 삭제와 같은 트랜잭션)
// 요청 하나 성공할 때마다 그만큼 로컬 상태에서 지움 → 일부 성공해도 다시 저장하면 남은 것만 감
// 실패하면 멈춤 → 모달 유지 + 에러 모달
//
//저장 후 캐시: portfolioAll · feedAll · 고친 사진 상세 무효화, 지운 사진 상세는 removeQueries
//
//TODO(백엔드 반영 후): 이미 수정·삭제돼 실패한 사진 → 서버가 에러에 id를 돌려줌 → 그 사진 안내 + 목록 새로고침

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

//프로필에서 내려주는 것
type PhotoManageModalProps = {
  open: boolean;
  onClose: () => void;
  photographerId: string;
};

//서버 batch 제한 (updates · deletes 각각)
const MAX_BATCH = 20;

//대표는 끌 수 없음 (대표 1장 유지, 서버도 null = 유지라 해제 미지원) → 다른 사진을 켜서 바꾸도록 안내
const REPRESENTATIVE_OFF_MESSAGE =
  '대표 이미지를 바꾸려면 다른 사진을 대표로 설정해 주세요.';

//다음 페이지가 남았는데 보이는 사진이 마지막 1장이면 빼기 막음
//(지우는 순간 대표 후보가 없어 대표가 비는 것 방지, 불러오기 실패 시 목록 끝 "다시 시도")
const REMOVE_BLOCKED_MESSAGE = '사진을 더 불러온 뒤 시도해주세요.';

//로그인 만료 토스트 · 판별 (PhotoUploadModal과 같은 코드)
//TODO(공용 에러): 공용 에러 처리 생기면 그걸로 교체 (메시지 비교 → status 기반)
const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐어요. 다시 로그인해 주세요.';
const isUnauthorized = (error: unknown) =>
  error instanceof Error &&
  (error.message === 'API 요청 실패: 401' ||
    error.message === '로그인이 필요한 요청입니다.');

//사진별 원본(처음 고칠 때 상세에서 복사) + 수정본
type PhotoDraft = {
  original: PhotoDetail;
  edited: PhotoDetail;
};

//저장 결과: 몇 묶음 성공했는지 + 실패했으면 그 에러
//updatedIds·deletedIds: 성공한 묶음에 들어 있던 id (캐시 갱신용, 서버 응답엔 없음)
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

  // ── 목록 ──
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = usePhotographerPhotos(open ? photographerId : undefined);
  const allPhotos = data?.pages.flatMap((page) => page.items) ?? [];

  // ── 내가 고친 값 (로컬) ──
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

  //지금 화면의 대표: 바꿨으면 그 사진, 아니면 서버 값 (삭제 대기면 없음)
  const currentRepresentativeId =
    representativeId ?? visiblePhotos.find((p) => p.isRepresentative)?.photoId;

  // ── 선택한 사진 상세 ──
  const detailQuery = useQuery({
    queryKey: queryKeys.photos.metadata(selected?.photoId ?? ''),
    queryFn: () => getPhotoData(selected!.photoId, fetchWithAuth),
    enabled: open && !!selected,
  });

  //폼에 보일 값: 고친 적 있으면 수정본, 아니면 서버 원본
  const selectedDetail: PhotoDetail | null = selected
    ? (drafts[selected.photoId]?.edited ??
      (detailQuery.data ? toDetail(detailQuery.data) : null))
    : null;

  // ── 바뀐 것 판단 ──
  const changedIds = Object.entries(drafts)
    .filter(([id, draft]) => isEdited(draft) && !deleteIds.includes(id))
    .map((item) => item[0]);

  const isDirty =
    changedIds.length > 0 || deleteIds.length > 0 || representativeId !== null;

  // ── 필수 요건을 충족햇나 판단 ──
  const hasMissingRequired = changedIds.some(
    (id) => drafts[id].edited.categories.length === 0,
  );

  // ── 입력 ──
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
    //끄기는 막고 안내만 (켜기만 가능 → 다른 사진을 켜면 대표가 바뀜)
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

  // ── 요청을 20개씩 저장 ──
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
  // ── 요청을 20개씩 요청 ──
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

  // ── 닫기 ──
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

  //바뀐 게 있으면 확인, 없으면 바로 닫기
  function requestClose() {
    if (isDirty) setConfirmOpen(true);
    else quit();
  }

  // ── PhotoEditor에 넘길 모양 ──
  const listItems: PhotoListItem[] = visiblePhotos.map((p, index) => ({
    localId: p.photoId,
    previewUrl: p.imageUrl,
    name: `사진 ${index + 1}`,
    missingRequired: drafts[p.photoId]?.edited.categories.length === 0,
    isRepresentative: p.photoId === currentRepresentativeId,
  }));

  //미리보기는 목록 값으로 바로 (상세 기다리지 않음 → 사진 바꿀 때 깜빡임 없음)
  //파일명·용량은 서버에 없어서 안 넘김 → 정보 줄 숨김
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
          //저장 중엔 닫기 무시 (나눠 보내는 루프가 도는 중)
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

      {/* 아래 모달들은 형제로 둬야 Esc·Tab이 그 모달 안에서만 처리됨 */}
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
