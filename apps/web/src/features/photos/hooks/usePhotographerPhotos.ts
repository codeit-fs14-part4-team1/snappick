//작가 사진 목록 무한 조회 (프로필 포트폴리오 · 상세 모달의 작가의 다른 사진)

import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getPhotographerPhotos } from '../api';

const PHOTOGRAPHER_PHOTOS_LIMIT = 20;

//excludePhotoId: 상세 모달에 띄운 사진 1장 제외, 프로필에서는 생략
export function usePhotographerPhotos(
  photographerId: string | undefined,
  options: { excludePhotoId?: string; limit?: number } = {},
) {
  const { user, authStatus, fetchWithAuth } = useAuth();
  const { excludePhotoId, limit = PHOTOGRAPHER_PHOTOS_LIMIT } = options;

  return useInfiniteQuery({
    queryKey: queryKeys.photos.portfolio(
      photographerId ?? '',
      user ? user.id : null,
      limit,
      excludePhotoId,
    ),

    queryFn: ({ pageParam }) =>
      getPhotographerPhotos(
        photographerId!,
        {
          cursor: pageParam,
          limit,
          excludePhotoId,
        },
        fetchWithAuth,
      ),
    //인증 초기화가 끝났고 id가 truthy한 값일 때
    enabled: authStatus !== 'initializing' && !!photographerId,

    initialPageParam: undefined as string | undefined,

    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
