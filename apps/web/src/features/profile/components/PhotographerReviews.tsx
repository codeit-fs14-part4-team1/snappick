'use client';

import { useState } from 'react';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/ToastProvider';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import styles from './PhotographerReviews.module.css';

// 한 페이지에 표시할 리뷰 개수
const REVIEW_PAGE_SIZE = 3;

// 리뷰별 사진작가 답글 데이터 타입 정의
type PhotographerReviewReply = {
  createdAt: string;
  comment: string;
};

// 작가 리뷰 데이터 타입 정의
export type PhotographerReview = {
  reviewId: string;
  authorName: string;
  createdAt: string;
  rating: number;
  comment: string;
  reply: PhotographerReviewReply | null;
};

// 서버 페이지네이션 데이터 타입 정의
type ReviewPagination = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

// 리뷰 목록 컴포넌트 Props 정의
type PhotographerReviewsProps = {
  reviews: PhotographerReview[];
  reviewCount: number;
  ratingAvg: number | null;
  pagination?: ReviewPagination;
  isSelf?: boolean;
  isReady?: boolean;

  // 사진작가가 자신의 리뷰에 답글을 작성할 때 호출함
  onCreateReply?: (reviewId: string, comment: string) => Promise<void>;

  // 사진작가가 기존 답글을 수정할 때 호출함
  onUpdateReply?: (reviewId: string, comment: string) => Promise<void>;

  // 사진작가가 기존 답글을 삭제할 때 호출함
  onDeleteReply?: (reviewId: string) => Promise<void>;
};

export default function PhotographerReviews({
  reviews,
  reviewCount,
  ratingAvg,
  pagination,
  isSelf = false,
  onCreateReply,
  onUpdateReply,
  onDeleteReply,
}: PhotographerReviewsProps) {
  // API 연결 전 기존 Mock 페이지네이션 상태 유지
  const [mockCurrentPage, setMockCurrentPage] = useState(1);

  // 리뷰 답글 등록 결과를 사용자에게 안내함
  const { showToast } = useToast();

  // 현재 답글 작성 중인 리뷰 ID를 관리함
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null);

  // 작성 중인 답글 내용을 관리함
  const [replyComment, setReplyComment] = useState('');

  // 답글 저장 중 중복 요청을 방지함
  const [isSavingReply, setIsSavingReply] = useState(false);

  // 현재 답글 수정 중인 리뷰 ID를 관리함
  const [editingReplyReviewId, setEditingReplyReviewId] = useState<
    string | null
  >(null);

  // 서버 페이지네이션이 전달되면 해당 페이지 번호를 사용함
  const currentPage = pagination?.currentPage ?? mockCurrentPage;

  // 서버 페이지 수를 우선 사용하고 Mock에서는 직접 계산함
  const totalPages =
    pagination?.totalPages ?? Math.ceil(reviewCount / REVIEW_PAGE_SIZE);

  // 서버 데이터는 그대로 표시하고 Mock 데이터만 분할함
  const currentReviews = pagination
    ? reviews
    : reviews.slice(
        (currentPage - 1) * REVIEW_PAGE_SIZE,
        currentPage * REVIEW_PAGE_SIZE,
      );

  // 서버 페이지네이션과 Mock 페이지네이션 동작을 구분함
  const handlePageChange = pagination?.onPageChange ?? setMockCurrentPage;

  // 답글 작성 버튼을 클릭하면 해당 리뷰의 입력창을 표시함
  const handleStartReply = (reviewId: string) => {
    if (isSavingReply) return;

    // 다른 리뷰에서 진행 중이던 답글 수정 상태를 종료함
    setEditingReplyReviewId(null);

    setReplyReviewId(reviewId);
    setReplyComment('');
  };

  // 답글 작성 또는 수정을 취소하고 입력 내용을 초기화함
  const handleCancelReply = () => {
    if (isSavingReply) return;

    setReplyReviewId(null);
    setEditingReplyReviewId(null);
    setReplyComment('');
  };
  // 작성한 답글을 서버에 등록함
  const handleSubmitReply = async () => {
    if (!replyReviewId || !onCreateReply || isSavingReply) return;

    const comment = replyComment.trim();

    // 서버의 답글 입력 조건을 확인함
    if (comment.length === 0) {
      showToast('답글 내용을 입력해 주세요.', 'error');
      return;
    }

    if (comment.length > 1000) {
      showToast('답글은 최대 1,000자까지 작성할 수 있어요.', 'error');
      return;
    }

    setIsSavingReply(true);

    try {
      // 기존 Mutation을 통해 답글 작성 API를 호출함
      await onCreateReply(replyReviewId, comment);

      // 등록 성공 후 입력 상태를 초기화함
      setReplyReviewId(null);
      setReplyComment('');

      showToast('답글을 등록했어요.');
    } catch (error) {
      console.error('리뷰 답글 등록 실패:', error);
      showToast('답글을 등록하지 못했어요.', 'error');
    } finally {
      setIsSavingReply(false);
    }
  };

  // 기존 답글 수정 버튼을 클릭하면 입력창에 현재 내용을 표시함
  const handleStartEditReply = (reviewId: string, comment: string) => {
    if (isSavingReply) return;

    // 다른 리뷰에서 진행 중이던 답글 작성 상태를 종료함
    setReplyReviewId(null);

    // 수정할 리뷰와 기존 답글 내용을 저장함
    setEditingReplyReviewId(reviewId);
    setReplyComment(comment);
  };

  // 수정한 답글을 서버에 저장함
  const handleSubmitEditReply = async () => {
    if (!editingReplyReviewId || !onUpdateReply || isSavingReply) return;

    const comment = replyComment.trim();

    // 서버의 답글 입력 조건을 확인함
    if (comment.length === 0) {
      showToast('답글 내용을 입력해 주세요.', 'error');
      return;
    }

    if (comment.length > 1000) {
      showToast('답글은 최대 1,000자까지 작성할 수 있어요.', 'error');
      return;
    }

    setIsSavingReply(true);

    try {
      // 기존 Mutation을 통해 답글 수정 API를 호출함
      await onUpdateReply(editingReplyReviewId, comment);

      // 수정 성공 후 입력 상태를 초기화함
      setEditingReplyReviewId(null);
      setReplyComment('');

      showToast('답글을 수정했어요.');
    } catch (error) {
      console.error('리뷰 답글 수정 실패:', error);
      showToast('답글을 수정하지 못했어요.', 'error');
    } finally {
      setIsSavingReply(false);
    }
  };

  // 기존 리뷰 답글을 삭제함
  const handleDeleteReply = async (reviewId: string) => {
    if (!onDeleteReply || isSavingReply) return;

    // 삭제 전 사용자에게 확인을 요청함
    const isConfirmed = window.confirm(
      '답글을 삭제하시겠어요?\n삭제한 답글은 복구할 수 없어요.',
    );

    if (!isConfirmed) return;

    // 삭제 중 중복 요청을 방지함
    setIsSavingReply(true);

    try {
      // 기존 Mutation을 통해 답글 삭제 API를 호출함
      await onDeleteReply(reviewId);

      showToast('답글을 삭제했어요.');
    } catch (error) {
      console.error('리뷰 답글 삭제 실패:', error);
      showToast('답글을 삭제하지 못했어요.', 'error');
    } finally {
      setIsSavingReply(false);
    }
  };

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-title"
      className={styles.reviews}
    >
      {/* 리뷰 제목, 평균 평점 및 전체 리뷰 수 표시 */}
      <div className={styles.header}>
        <h2 id="reviews-title" className={styles.title}>
          리뷰
        </h2>

        {ratingAvg !== null && (
          <span
            className={styles.rating}
            aria-label={`평균 평점 ${ratingAvg.toFixed(1)}점`}
          >
            ★ {ratingAvg.toFixed(1)}
          </span>
        )}

        <span className={styles.reviewCount}>
          {reviewCount.toLocaleString('ko-KR')}개
        </span>
      </div>

      {/* 실제 리뷰가 0개이면 프로필 준비 상태와 관계없이 빈 상태 박스를 표시함 */}
      {currentReviews.length === 0 ? (
        reviewCount === 0 ? (
          <div className={styles.emptyStateOwn}>
            <p className={styles.emptyStateOwnTitle}>
              {isSelf
                ? '아직 받은 리뷰가 없어요'
                : '아직 작성된 리뷰가 없습니다.'}
            </p>
          </div>
        ) : (
          // 리뷰는 있지만 현재 페이지에 표시할 항목이 없는 경우를 처리함
          <p className={styles.emptyState}>
            현재 페이지에 표시할 리뷰가 없습니다.
          </p>
        )
      ) : (
        // 리뷰 목록 표시
        <ul className={styles.reviewList}>
          {currentReviews.map((review) => (
            <li key={review.reviewId} className={styles.reviewItem}>
              {/* 리뷰 작성자 및 작성일 표시 */}
              <div className={styles.reviewMeta}>
                <strong className={styles.author}>{review.authorName}</strong>

                <time dateTime={review.createdAt} className={styles.date}>
                  {formatRelativeTime(review.createdAt)}
                </time>
              </div>

              {/* 리뷰 별점 표시 */}
              <div
                className={styles.stars}
                role="img"
                aria-label={`5점 만점에 ${review.rating}점`}
              >
                {'★'.repeat(review.rating)}
                {'☆'.repeat(Math.max(0, 5 - review.rating))}
              </div>

              {/* 리뷰 내용 표시 */}
              <p className={styles.comment}>{review.comment}</p>

              {/* 사진작가 답글이 있는 경우 표시함 */}
              {review.reply &&
                (isSelf &&
                onUpdateReply &&
                editingReplyReviewId === review.reviewId ? (
                  // 답글 수정 중에는 회색 박스 대신 입력창을 표시함
                  <form
                    className={styles.replyEditor}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSubmitEditReply();
                    }}
                  >
                    <textarea
                      id={`edit-reply-${review.reviewId}`}
                      aria-label="작가 답글 수정"
                      className={styles.replyTextarea}
                      value={replyComment}
                      onChange={(event) => setReplyComment(event.target.value)}
                      placeholder="답글 내용을 입력해 주세요."
                      maxLength={1000}
                      rows={3}
                      disabled={isSavingReply}
                    />

                    {/* 답글 수정 취소 및 완료 버튼을 표시함 */}
                    <div className={styles.replyEditorFooter}>
                      <div className={styles.replyEditorButtons}>
                        <button
                          type="button"
                          className={styles.replyCancelButton}
                          onClick={handleCancelReply}
                          disabled={isSavingReply}
                        >
                          취소
                        </button>

                        <button
                          type="submit"
                          className={styles.replySubmitButton}
                          disabled={isSavingReply || !replyComment.trim()}
                        >
                          {isSavingReply ? '수정 중...' : '수정 완료'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  // 등록된 답글은 기존 회색 박스를 유지함
                  <div className={styles.reply}>
                    <div className={styles.replyMeta}>
                      {/* 답글 제목과 작성일을 왼쪽에 표시함 */}
                      <div className={styles.replyMetaInfo}>
                        <strong className={styles.replyTitle}>작가 답글</strong>

                        <time
                          dateTime={review.reply.createdAt}
                          className={styles.replyDate}
                        >
                          {formatRelativeTime(review.reply.createdAt)}
                        </time>
                      </div>

                      {/* 작가 본인에게만 수정 및 삭제 버튼을 표시함 */}
                      {isSelf && (onUpdateReply || onDeleteReply) && (
                        <div className={styles.replyHeaderActions}>
                          {onUpdateReply && (
                            <button
                              type="button"
                              className={styles.replyTextButton}
                              onClick={() =>
                                handleStartEditReply(
                                  review.reviewId,
                                  review.reply?.comment ?? '',
                                )
                              }
                              disabled={isSavingReply}
                            >
                              수정
                            </button>
                          )}

                          {onDeleteReply && (
                            <button
                              type="button"
                              className={styles.replyTextButton}
                              onClick={() =>
                                void handleDeleteReply(review.reviewId)
                              }
                              disabled={isSavingReply}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 기존 답글 내용을 표시함 */}
                    <p className={styles.replyComment}>
                      {review.reply.comment}
                    </p>
                  </div>
                ))}

              {/* 작가 본인이고 답글이 없는 리뷰에만 작성 기능을 제공함 */}
              {isSelf && !review.reply && onCreateReply && (
                <div className={styles.replyActionArea}>
                  {replyReviewId === review.reviewId ? (
                    // 답글 작성 중에는 Figma 디자인의 입력 영역을 표시함
                    <form
                      className={styles.replyEditor}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleSubmitReply();
                      }}
                    >
                      {/* 별도 제목 없이 답글 입력창만 표시함 */}
                      <textarea
                        id={`reply-${review.reviewId}`}
                        aria-label="작가 답글 작성"
                        className={styles.replyTextarea}
                        value={replyComment}
                        onChange={(event) =>
                          setReplyComment(event.target.value)
                        }
                        placeholder="리뷰에 대한 답글을 작성해 주세요."
                        maxLength={1000}
                        rows={3}
                        disabled={isSavingReply}
                      />

                      {/* 입력창 오른쪽 하단에 취소 및 등록 버튼을 표시함 */}
                      <div className={styles.replyEditorFooter}>
                        <div className={styles.replyEditorButtons}>
                          <button
                            type="button"
                            className={styles.replyCancelButton}
                            onClick={handleCancelReply}
                            disabled={isSavingReply}
                          >
                            취소
                          </button>

                          <button
                            type="submit"
                            className={styles.replySubmitButton}
                            disabled={isSavingReply || !replyComment.trim()}
                          >
                            {isSavingReply ? '등록 중...' : '등록'}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    // 답글을 작성하지 않은 경우 작성 버튼을 표시함
                    <button
                      type="button"
                      className={styles.replyWriteButton}
                      onClick={() => handleStartReply(review.reviewId)}
                      disabled={isSavingReply}
                    >
                      답글 작성
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 리뷰가 있는 경우 페이지네이션 표시 */}
      {currentReviews.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          className={styles.pagination}
          aria-label="작가 리뷰 페이지 이동"
        />
      )}
    </section>
  );
}
