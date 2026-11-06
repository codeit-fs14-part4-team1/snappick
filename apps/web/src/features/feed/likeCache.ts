import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { FeedPhoto, FeedPhotosResponse } from './types';
import { queryKeys } from '@/lib/queryKeys';

const FEED_KEY_PREFIX = queryKeys.photos.feedAll();

//피드 캐시 전체(필터무관) like, likeCount Update
export function updateFeedPhoto(
  queryClient: QueryClient,
  photoId: string,
  update: (photo: FeedPhoto) => FeedPhoto,
) {
  queryClient.setQueriesData<InfiniteData<FeedPhotosResponse>>(
    { queryKey: FEED_KEY_PREFIX },
    (old) => {
      //페이지 객체 업데이트
      if (!old) return old;
      let changed = false;
      const pages = old.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => {
          if (item.photoId !== photoId) return item;
          changed = true;
          return update(item);
        }),
      }));
      return changed ? { ...old, pages } : old;
    },
  );
}
