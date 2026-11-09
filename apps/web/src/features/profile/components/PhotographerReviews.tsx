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

// 리뷰 목록 컴포넌트 Props 정의
type PhotographerReviewsProps = {
  reviews: PhotographerReview[];
  reviewCount: number;
  ratingAvg: number | null;
};

export default function PhotographerReviews({
  reviews,
  reviewCount,
  ratingAvg,
}: PhotographerReviewsProps) {
  // 현재 리뷰 페이지 번호 관리
  const [currentPage, setCurrentPage] = useState(1);

  // 전체 페이지 수 계산
  const totalPages = Math.ceil(reviewCount / REVIEW_PAGE_SIZE);

  // 현재 페이지의 첫 번째 리뷰 인덱스 계산
  const startIndex = (currentPage - 1) * REVIEW_PAGE_SIZE;

  // 현재 페이지에 표시할 리뷰만 추출
  const currentReviews = reviews.slice(
    startIndex,
    startIndex + REVIEW_PAGE_SIZE,
  );

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

      {reviews.length === 0 ? (
        // 리뷰가 없는 경우 안내 문구 표시
        <p className={styles.emptyState}>아직 작성된 리뷰가 없습니다.</p>
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
      {reviews.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className={styles.pagination}
          aria-label="작가 리뷰 페이지 이동"
        />
      )}
    </section>
  );
}
