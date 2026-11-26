import type { FetchWithAuth } from '@/features/auth/types';

export const REVIEW_PAGE_SIZE = 5;

type PageResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type ReviewPhotographer = {
  photographerId: string;
  nickname: string;
  profileImageUrl: string | null;
  representativeImageUrl: string | null;
};

export type EligibleReviewResponse = {
  reservationId: string;
  quoteName: string | null;
  shootAt: string;
  photographer: ReviewPhotographer | null;
};

export type ReviewResponse = {
  reviewId: string;
  reservationId: string | null;
  shootAt: string | null;
  quoteName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  photographer: ReviewPhotographer | null;
  reply: { comment: string; createdAt: string } | null;
};

export type ReviewsResponse = PageResponse<ReviewResponse>;

export async function getEligibleReviews(
  fetchWithAuth: FetchWithAuth,
  page: number,
) {
  const result = await fetchWithAuth<PageResponse<EligibleReviewResponse>>(
    `/me/reviews/eligible?page=${page}&pageSize=${REVIEW_PAGE_SIZE}`,
  );
  if (!result) throw new Error('작성 가능한 리뷰를 불러오지 못했어요.');
  return result;
}

export async function getMyReviews(fetchWithAuth: FetchWithAuth, page: number) {
  const result = await fetchWithAuth<ReviewsResponse>(
    `/me/reviews?page=${page}&pageSize=${REVIEW_PAGE_SIZE}`,
  );
  if (!result) throw new Error('리뷰 목록을 불러오지 못했어요.');
  return result;
}

export async function saveMyReview(
  fetchWithAuth: FetchWithAuth,
  input: { rating: number; comment: string } & (
    { reviewId: string } | { reservationId: string }
  ),
) {
  const editing = 'reviewId' in input;
  const result = await fetchWithAuth<{ photographerId: string | null }>(
    editing ? `/me/reviews/${input.reviewId}` : '/me/reviews',
    {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(!editing && { reservationId: input.reservationId }),
        rating: input.rating,
        comment: input.comment,
      }),
    },
  );
  if (!result) throw new Error('리뷰를 저장하지 못했어요.');
  return result;
}
