import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { getPhotographerReviews } from '../api';

const REVIEW_PAGE_SIZE = 3;

// 특정 작가의 리뷰 목록을 페이지별로 조회함
export function usePhotographerReviews(
  photographerId: string | undefined,
  page: number = 1,
) {
  const { authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    queryKey: queryKeys.reviews.byPhotographer(photographerId ?? '', {
      page,
      pageSize: REVIEW_PAGE_SIZE,
    }),

    // 선택한 페이지의 리뷰 3개를 조회함
    queryFn: () =>
      getPhotographerReviews(
        photographerId!,
        {
          page,
          pageSize: REVIEW_PAGE_SIZE,
        },
        fetchWithAuth,
      ),

    // 인증 초기화가 완료되고 작가 ID가 있을 때 조회함
    enabled: authStatus !== 'initializing' && !!photographerId,
  });
}
