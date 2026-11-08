//좋아요 캐시 처리: 같은 사진의 liked · likeCount를 모든 캐시에서 한 번에 맞춘다

import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

type LikeState = { liked: boolean; likeCount: number };
type LikeItem = LikeState & { photoId: string };

export type LikeUpdate = (current: LikeState) => LikeState;

//무한 쿼리 한 종류: 페이지를 돌며 photoId가 같은 항목만 바꿈
function updateInfiniteList(
  queryClient: QueryClient,
  queryKey: QueryKey,
  photoId: string,
  update: LikeUpdate,
) {
  queryClient.setQueriesData<InfiniteData<{ items: LikeItem[] }>>(
    { queryKey },
    (old) => {
      if (!old) return old;
      let changed = false;
      const pages = old.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => {
          if (item.photoId !== photoId) return item;
          changed = true;
          return { ...item, ...update(item) };
        }),
      }));
      return changed ? { ...old, pages } : old;
    },
  );
}

//상세 단건: liked가 없는 데이터(metadata)는 건드리지 않음
function updateDetail(
  queryClient: QueryClient,
  photoId: string,
  viewerId: string | null,
  update: LikeUpdate,
) {
  queryClient.setQueriesData<LikeState>(
    { queryKey: queryKeys.photos.detail(photoId, viewerId), exact: true },
    (old) => {
      if (!old) return;
      return { ...old, ...update(old) };
    },
  );
}

export function updatePhotoLikeCache(
  queryClient: QueryClient,
  photoId: string,
  viewerId: string | null,
  update: LikeUpdate,
) {
  updateInfiniteList(queryClient, queryKeys.photos.feedAll(), photoId, update);
  updateInfiniteList(
    queryClient,
    queryKeys.photos.portfolioAll(),
    photoId,
    update,
  );
  updateInfiniteList(queryClient, queryKeys.photos.likedAll(), photoId, update);
  updateDetail(queryClient, photoId, viewerId, update);
}

//성공 후: 좋아요 목록 다시 조회
export function invalidateLikedPhotos(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.photos.likedAll() });
}
