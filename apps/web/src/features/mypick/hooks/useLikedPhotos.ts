import { queryKeys } from '@/lib/queryKeys';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getLikedPhotos } from '../api';

const LIKED_PHOTOS_LIMIT = 20;

//MY 픽 좋아요한 사진 무한 조회
export function useLikedPhotos(options: { limit?: number } = {}) {
  const { fetchWithAuth } = useAuth();
  const { limit = LIKED_PHOTOS_LIMIT } = options;

  return useInfiniteQuery({
    queryKey: queryKeys.photos.liked(limit),
    queryFn: ({ pageParam }) =>
      getLikedPhotos({ cursor: pageParam, limit }, fetchWithAuth),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
