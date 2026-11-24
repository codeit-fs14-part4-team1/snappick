import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import { getEligibleReviews, saveMyReview } from '@/features/my/reviews/api';

// 특정 예약의 리뷰 작성 가능 여부를 조회
export function useReservationReviewEligibility(
  reservationId: string,
  enabled: boolean,
) {
  const { authStatus, user, fetchWithAuth } = useAuth();

  return useQuery({
    queryKey: [
      ...queryKeys.reviews.all,
      'detail',
      reservationId,
      'eligibility',
    ],

    queryFn: async () => {
      let page = 1;

      while (true) {
        const response = await getEligibleReviews(fetchWithAuth, page);

        const booking = response.items.find(
          (item) => item.reservationId === reservationId,
        );

        // 해당 예약이 작성 가능 목록에 있으면 반환
        if (booking) {
          return booking;
        }

        // 마지막 페이지까지 해당 예약이 없다면 작성 불가
        if (page >= response.totalPages) {
          return null;
        }

        page += 1;
      }
    },

    // 구매 확정된 일반 사용자 예약에서만 조회
    enabled:
      authStatus === 'authenticated' &&
      user?.accountType === 'USER' &&
      Boolean(reservationId) &&
      enabled,

    retry: false,
  });
}

// 해당 예약의 리뷰를 최초 등록
export function useCreateReservationReview(reservationId: string) {
  const { fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rating, comment }: { rating: number; comment: string }) =>
      saveMyReview(fetchWithAuth, {
        reservationId,
        rating,
        comment: comment.trim(),
      }),

    onSuccess: async (response) => {
      // 리뷰 등록에 성공하면 해당 예약은 작성 불가 상태로 변경
      queryClient.setQueryData(
        [...queryKeys.reviews.all, 'detail', reservationId, 'eligibility'],
        null,
      );

      // 작성 가능한 리뷰 및 작성한 리뷰 목록 갱신
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: queryKeys.reviews.all,
        }),
      ];

      // 해당 작가의 프로필 및 AI 리뷰 요약 캐시 갱신
      if (response.photographerId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.photographers
              .detail(response.photographerId, null)
              .slice(0, 3),
          }),
          queryClient.invalidateQueries({
            queryKey: ['photographer-review-summary', response.photographerId],
          }),
        );
      }

      await Promise.all(invalidations);
    },
  });
}
