'use client';

import { useState } from 'react';
import Pagination from '@/components/ui/Pagination';
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
};

export default function PhotographerReviews({
  reviews,
  reviewCount,
  ratingAvg,
  pagination,
  isSelf = false,
  isReady = true,
}: PhotographerReviewsProps) {
  // API 연결 전 기존 Mock 페이지네이션 상태 유지
  const [mockCurrentPage, setMockCurrentPage] = useState(1);

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

      {/* 리뷰가 없는 경우 본인 미설정 상태와 공개 상태를 구분함 */}
      {currentReviews.length === 0 ? (
        isSelf && !isReady && reviewCount === 0 ? (
          // 작가 본인 미설정 상태의 리뷰 안내
          <div className={styles.emptyStateOwn}>
            <p className={styles.emptyStateOwnTitle}>아직 받은 리뷰가 없어요</p>
          </div>
        ) : (
          // 공개 프로필에서는 기존 빈 상태 안내를 유지함
          <p className={styles.emptyState}>아직 작성된 리뷰가 없습니다.</p>
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

              {/* 사진작가 답글이 있는 경우 표시 */}
              {review.reply && (
                <div className={styles.reply}>
                  <div className={styles.replyMeta}>
                    <strong className={styles.replyTitle}>작가 답글</strong>

                    <time
                      dateTime={review.reply.createdAt}
                      className={styles.replyDate}
                    >
                      {formatRelativeTime(review.reply.createdAt)}
                    </time>
                  </div>

                  <p className={styles.replyComment}>{review.reply.comment}</p>
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
