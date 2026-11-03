//데이터 식별, 캐싱, 페이지(탐색)관리

//import 및 상수
import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getFeedPhotos } from '../api';
import { getFeedSeed } from '../seed';
import type { FeedPhotosParams } from '../types';

const FEED_LIMIT = 5;

//훅이 받는 '탐색 조건' 타입
export type FeedFilters = Omit<FeedPhotosParams, 'seed' | 'cursor' | 'limit'>;

//커서기반 탐색
export function useExploreFeed(filters: FeedFilters) {
  const isRandom = (filters.sort ?? 'random') === 'random';

  return useInfiniteQuery({
    queryKey: queryKeys.photos.feed({
      viewerId: null,
      ...filters,
      limit: FEED_LIMIT,
    }),

    queryFn: ({ pageParam }) =>
      getFeedPhotos({
        ...filters,
        limit: FEED_LIMIT,
        cursor: pageParam,
        seed: isRandom ? getFeedSeed() : undefined,
      }),

    initialPageParam: undefined as string | undefined,

    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
