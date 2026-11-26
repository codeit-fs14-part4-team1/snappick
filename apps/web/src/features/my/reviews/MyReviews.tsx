'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import {
  getEligibleReviews,
  getMyReviews,
  isReviewAlreadyExists,
  REVIEW_ALREADY_EXISTS_MESSAGE,
  REVIEW_PAGE_SIZE,
  saveMyReview,
} from './api';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import StateMessage from '@/components/ui/StateMessage';
import Tabs from '@/components/ui/Tabs';
import {
  formatDate,
  formatDateWithWeekday as formatShootDate,
} from '@/utils/dateTime';
import type { MyReview, ReviewBooking } from './types';
import styles from './MyReviews.module.css';

function ReviewStar({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={filled ? styles.filled : styles.unfilled}
    >
      <path
        d="m16 1 3.6 10.8H31l-9.2 6.7L25.3 30 16 23.1 6.7 30l3.5-11.5L1 11.8h11.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
type Editor = { booking: ReviewBooking; review?: MyReview };

export default function MyReviews() {
  const [tab, setTab] = useState('available');
  const [page, setPage] = useState(1);
  const { user, fetchWithAuth } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<MyReview | null>(null);
  const eligibleQuery = useQuery({
    queryKey: queryKeys.reviews.eligible({
      page: tab === 'available' ? page : 1,
      pageSize: REVIEW_PAGE_SIZE,
    }),
    queryFn: () =>
      getEligibleReviews(fetchWithAuth, tab === 'available' ? page : 1),
    enabled: user?.accountType === 'USER',
    retry: false,
  });
  const bookings: ReviewBooking[] = (eligibleQuery.data?.items ?? []).map(
    (item) => ({
      reservationId: item.reservationId,
      photographerId: item.photographer?.photographerId,
      photographerName: item.photographer?.nickname ?? '작가 정보 없음',
      representativeImageUrl: item.photographer?.representativeImageUrl ?? null,
      quoteName: item.quoteName ?? '견적 정보 없음',
      shootDate: item.shootAt,
    }),
  );
  const query = useQuery({
    queryKey: queryKeys.reviews.me({
      page: tab === 'written' ? page : 1,
      pageSize: REVIEW_PAGE_SIZE,
    }),
    queryFn: () => getMyReviews(fetchWithAuth, tab === 'written' ? page : 1),
    enabled: user?.accountType === 'USER',
    retry: false,
  });
  const activeQuery = tab === 'available' ? eligibleQuery : query;
  const reviews: MyReview[] = (query.data?.items ?? []).map((review) => ({
    id: review.reviewId,
    booking: {
      reservationId: review.reservationId ?? '',
      photographerId: review.photographer?.photographerId,
      photographerName: review.photographer?.nickname ?? '작가 정보 없음',
      representativeImageUrl:
        review.photographer?.representativeImageUrl ?? null,
      quoteName: review.quoteName ?? '',
      shootDate: review.shootAt ?? '',
    },
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    reply: review.reply,
  }));
  function invalidateReviewQueries(photographerId?: string | null) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
    if (!photographerId) return;
    void queryClient.invalidateQueries({
      // 조회 사용자에 관계없이 해당 작가의 프로필 캐시를 갱신합니다.
      queryKey: queryKeys.photographers
        .detail(photographerId, null)
        .slice(0, 3),
    });
    void queryClient.invalidateQueries({
      queryKey: ['photographer-review-summary', photographerId],
    });
  }

  const save = useMutation({
    mutationFn: ({ rating, comment }: { rating: number; comment: string }) => {
      if (!editor) throw new Error('작성 중인 리뷰가 없습니다.');
      return saveMyReview(fetchWithAuth, {
        rating,
        comment,
        ...(editor.review
          ? { reviewId: editor.review.id }
          : { reservationId: editor.booking.reservationId }),
      });
    },
    onSuccess: (result) => {
      setEditor(null);
      setTab('written');
      setPage(1);
      invalidateReviewQueries(result.photographerId);
      showToast('리뷰를 저장했어요.');
    },
    onError: (error) => {
      if (isReviewAlreadyExists(error)) {
        setEditor(null);
        setPage(1);
        invalidateReviewQueries();
        showToast(REVIEW_ALREADY_EXISTS_MESSAGE);
        return;
      }
      showToast('리뷰를 저장하지 못했어요. 다시 시도해 주세요.', 'error');
    },
  });
  const remove = useMutation({
    mutationFn: async (review: MyReview) => {
      await fetchWithAuth(`/me/reviews/${review.id}`, { method: 'DELETE' });
    },
    onSuccess: (_result, review) => {
      setDeleting(null);
      if (reviews.length === 1 && page > 1) setPage(page - 1);
      invalidateReviewQueries(review.booking.photographerId);
      showToast('리뷰를 삭제했어요.');
    },
    onError: () =>
      showToast('리뷰를 삭제하지 못했어요. 다시 시도해 주세요.', 'error'),
  });

  return (
    <>
      <Tabs
        aria-label="리뷰 분류"
        className={styles.tabs}
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setPage(1);
        }}
        items={[
          {
            value: 'available',
            label: '작성 가능',
            count: eligibleQuery.data?.totalCount,
          },
          {
            value: 'written',
            label: '작성한 리뷰',
            count: query.data?.totalCount,
          },
        ]}
      />
      {activeQuery.isPending ? (
        <StateMessage
          className={styles.empty}
          title="리뷰를 불러오는 중이에요"
          role="status"
        />
      ) : activeQuery.isError ? (
        <StateMessage
          className={styles.empty}
          title="리뷰를 불러오지 못했어요"
          role="alert"
          button={{
            label: '다시 시도',
            onClick: () => {
              void activeQuery.refetch();
            },
            disabled: activeQuery.isFetching,
          }}
        />
      ) : activeQuery.data?.totalCount &&
        activeQuery.data.items.length === 0 ? (
        <StateMessage
          className={styles.empty}
          title="현재 페이지에 표시할 리뷰가 없어요"
          button={{ label: '첫 페이지로', onClick: () => setPage(1) }}
        />
      ) : tab === 'available' ? (
        bookings.length ? (
          <ul
            className={styles.bookings}
            aria-label="리뷰를 작성할 수 있는 예약"
          >
            {bookings.map((booking) => (
              <li key={booking.reservationId} className={styles.booking}>
                <div className={styles.bookingText}>
                  <p className={styles.bookingName}>
                    {booking.photographerName} · {booking.quoteName}
                  </p>
                  <p className={styles.date}>
                    {formatShootDate(booking.shootDate)}
                  </p>
                </div>
                <Button
                  size="md"
                  className={styles.writeButton}
                  onClick={() => setEditor({ booking })}
                  aria-label={`${booking.photographerName} ${booking.quoteName} 리뷰 쓰기`}
                >
                  리뷰 쓰기
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <StateMessage
            className={styles.empty}
            title="작성할 수 있는 리뷰가 없어요"
            description="구매 확정한 촬영이 있으면 여기에 보여요"
          />
        )
      ) : reviews.length ? (
        <ul className={styles.reviews} aria-label="작성한 리뷰">
          {reviews.map((review) => (
            <li key={review.id} className={styles.review}>
              <div className={styles.reviewHeader}>
                <div className={styles.author}>
                  <span className={styles.bookingName}>
                    {review.booking.photographerName}
                  </span>
                  <span className={styles.date}>
                    {formatDate(review.createdAt)}
                  </span>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={() =>
                      setEditor({ booking: review.booking, review })
                    }
                    aria-label={`${review.booking.photographerName} 리뷰 수정`}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(review)}
                    aria-label={`${review.booking.photographerName} 리뷰 삭제`}
                  >
                    삭제
                  </button>
                </div>
              </div>
              <p
                className={styles.rating}
                aria-label={`별점 5점 중 ${review.rating}점`}
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <ReviewStar key={index} filled={index < review.rating} />
                ))}
              </p>
              <p className={styles.comment}>{review.comment}</p>
              {review.reply && (
                <div className={styles.reply}>
                  <div className={styles.author}>
                    <strong>작가 답글</strong>
                    <span className={styles.date}>
                      {formatDate(review.reply.createdAt)}
                    </span>
                  </div>
                  <p className={styles.comment}>{review.reply.comment}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <StateMessage
          className={styles.empty}
          title="작성한 리뷰가 없어요"
          description="촬영 후기를 남겨 보세요"
        />
      )}
      {!activeQuery.isError &&
        activeQuery.data &&
        activeQuery.data.totalPages > 1 && (
          <div className={styles.pagination}>
            <Pagination
              currentPage={page}
              totalPages={activeQuery.data.totalPages}
              onPageChange={setPage}
              aria-label="리뷰 목록 페이지 이동"
            />
          </div>
        )}
      {editor && (
        <ReviewEditor
          editor={editor}
          onClose={() => {
            if (!save.isPending) setEditor(null);
          }}
          pending={save.isPending}
          onSave={(rating, comment) => {
            if (!save.isPending) save.mutate({ rating, comment });
          }}
        />
      )}
      <Modal
        open={deleting !== null}
        onClose={() => {
          if (!remove.isPending) setDeleting(null);
        }}
        closeOnEscape={!remove.isPending}
        closeOnBackdrop={!remove.isPending}
        variant="confirm"
        title="리뷰를 삭제할까요?"
        description="삭제한 리뷰는 다시 작성할 수 없고, 작가 답글도 함께 삭제돼요."
        className={styles.confirm}
        footer={
          <>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setDeleting(null)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                if (deleting && !remove.isPending) remove.mutate(deleting);
              }}
            >
              삭제
            </Button>
          </>
        }
      />
    </>
  );
}

function ReviewEditor({
  editor,
  onClose,
  onSave,
  pending,
}: {
  editor: Editor;
  pending: boolean;
  onClose: () => void;
  onSave: (rating: number, comment: string) => void;
}) {
  const id = useId();
  const [rating, setRating] = useState(editor.review?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayedRating = rating === 0 ? (hoverRating ?? 0) : rating;
  const [comment, setComment] = useState(editor.review?.comment ?? '');
  const canSubmit =
    !pending &&
    rating > 0 &&
    comment.trim().length > 0 &&
    comment.length <= 200;
  return (
    <Modal
      open
      onClose={onClose}
      closeOnEscape={!pending}
      closeOnBackdrop={!pending}
      title={editor.review ? '리뷰 수정' : '리뷰 쓰기'}
      className={styles.modal}
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={onClose}
          >
            취소
          </Button>
          <Button type="submit" size="lg" form={id} disabled={!canSubmit}>
            {editor.review ? '수정 완료' : '등록하기'}
          </Button>
        </>
      }
    >
      <form
        aria-busy={pending}
        id={id}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSave(rating, comment.trim());
        }}
      >
        <div className={styles.summary}>
          {editor.booking.representativeImageUrl ? (
            <Image
              src={editor.booking.representativeImageUrl}
              alt=""
              width={56}
              height={56}
              className={styles.thumbnail}
            />
          ) : (
            <span className={styles.thumbnail} aria-hidden="true" />
          )}
          <div className={styles.bookingText}>
            <p className={styles.bookingName}>
              {editor.booking.photographerName}
              {editor.booking.quoteName && ` · ${editor.booking.quoteName}`}
            </p>
            {editor.booking.shootDate && (
              <p className={styles.date}>
                {formatShootDate(editor.booking.shootDate)}
              </p>
            )}
          </div>
        </div>
        <fieldset className={styles.ratingField}>
          <legend>촬영은 만족스러우셨나요?</legend>
          <div
            className={styles.stars}
            onMouseLeave={() => setHoverRating(null)}
          >
            {[1, 2, 3, 4, 5].map((score) => (
              <label
                key={score}
                className={styles.star}
                onMouseEnter={() => {
                  if (rating === 0) setHoverRating(score);
                }}
              >
                <input
                  disabled={pending}
                  type="radio"
                  name={`${id}-rating`}
                  value={score}
                  checked={rating === score}
                  onChange={() => setRating(score)}
                  aria-label={`${score}점`}
                />
                <ReviewStar filled={score <= displayedRating} />
              </label>
            ))}
          </div>
          {!rating && <p className={styles.date}>별점을 선택해 주세요</p>}
        </fieldset>
        <div className={styles.field}>
          <div className={styles.labelWithCount}>
            <label htmlFor={`${id}-comment`}>리뷰 내용</label>
            <p id={`${id}-count`} className={styles.date}>
              {comment.length} / 200
            </p>
          </div>
          <textarea
            id={`${id}-comment`}
            value={comment}
            onChange={(event) => {
              const textarea = event.currentTarget;
              const value = textarea.value.slice(0, 200);
              if (textarea.value.length > 200) textarea.value = value;
              setComment(value);
            }}
            disabled={pending}
            maxLength={200}
            placeholder="촬영 분위기, 결과물 만족도 등을 자유롭게 남겨 주세요."
            aria-describedby={`${id}-count`}
          />
        </div>
      </form>
    </Modal>
  );
}
