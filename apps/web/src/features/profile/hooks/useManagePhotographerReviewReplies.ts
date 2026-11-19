import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import {
  createPhotographerReviewReply,
  updatePhotographerReviewReply,
  deletePhotographerReviewReply,
} from '../api';

// 리뷰 답글 작성 및 수정에 사용할 입력값을 정의함
type ReviewReplyInput = {
  reviewId: string;
  comment: string;
};

// 사진작가의 리뷰 답글 작성·수정·삭제 상태를 관리함
export function useManagePhotographerReviewReplies() {
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useAuth();

  // 답글 변경 후 관련 리뷰 목록을 다시 조회하도록 처리함
  const invalidateReviews = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.reviews.all,
    });

  // 새로운 리뷰 답글을 작성함
  const createMutation = useMutation({
    mutationFn: ({ reviewId, comment }: ReviewReplyInput) =>
      createPhotographerReviewReply(reviewId, { comment }, fetchWithAuth),

    // 작성 성공 후 리뷰 목록을 최신 상태로 갱신함
    onSuccess: invalidateReviews,
  });

  // 기존 리뷰 답글을 수정함
  const updateMutation = useMutation({
    mutationFn: ({ reviewId, comment }: ReviewReplyInput) =>
      updatePhotographerReviewReply(reviewId, { comment }, fetchWithAuth),

    // 수정 성공 후 변경된 답글을 다시 조회함
    onSuccess: invalidateReviews,
  });

  // 기존 리뷰 답글을 삭제함
  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) =>
      deletePhotographerReviewReply(reviewId, fetchWithAuth),

    // 삭제 성공 후 기존 답글이 화면에서 사라지도록 갱신함
    onSuccess: invalidateReviews,
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
