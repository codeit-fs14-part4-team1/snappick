'use client';

import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import StateMessage from '@/components/ui/StateMessage';
import Tabs from '@/components/ui/Tabs';
import {
  formatDate,
  formatDateWithWeekday as formatShootDate,
} from '@/utils/dateTime';
import { mockMyReviews, mockReviewBookings } from './mocks';
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
  const [bookings, setBookings] = useState(mockReviewBookings);
  const [reviews, setReviews] = useState(mockMyReviews);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<MyReview | null>(null);

  function saveReview(rating: number, comment: string) {
    if (!editor) return;
    // API 연결 전까지 화면 상태만 변경하며, 새로고침하면 초기화됩니다.
    if (editor.review) {
      setReviews((current) =>
        current.map((review) =>
          review.id === editor.review?.id
            ? { ...review, rating, comment }
            : review,
        ),
      );
    } else {
      const createdAt = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul',
      }).format(new Date());
      setReviews((current) => [
        {
          id: crypto.randomUUID(),
          booking: editor.booking,
          rating,
          comment,
          createdAt,
          reply: null,
        },
        ...current,
      ]);
      setBookings((current) =>
        current.filter(
          (booking) => booking.reservationId !== editor.booking.reservationId,
        ),
      );
      setTab('written');
    }
    setEditor(null);
  }

  return (
    <>
      <Tabs
        aria-label="리뷰 분류"
        className={styles.tabs}
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'available', label: '작성 가능', count: bookings.length },
          { value: 'written', label: '작성한 리뷰', count: reviews.length },
        ]}
      />
      {tab === 'available' ? (
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
      {editor && (
        <ReviewEditor
          editor={editor}
          onClose={() => setEditor(null)}
          onSave={saveReview}
        />
      )}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        variant="confirm"
        title="리뷰를 삭제할까요?"
        description="삭제한 리뷰는 다시 작성할 수 없고, 작가 답글도 함께 삭제돼요."
        className={styles.confirm}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setReviews((current) =>
                  current.filter((review) => review.id !== deleting?.id),
                );
                setDeleting(null);
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
}: {
  editor: Editor;
  onClose: () => void;
  onSave: (rating: number, comment: string) => void;
}) {
  const id = useId();
  const [rating, setRating] = useState(editor.review?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayedRating = rating === 0 ? (hoverRating ?? 0) : rating;
  const [comment, setComment] = useState(editor.review?.comment ?? '');
  const canSubmit =
    rating > 0 && comment.trim().length > 0 && comment.length <= 200;
  return (
    <Modal
      open
      onClose={onClose}
      title={editor.review ? '리뷰 수정' : '리뷰 쓰기'}
      className={styles.modal}
      footer={
        <>
          <Button variant="outline" size="lg" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="lg" form={id} disabled={!canSubmit}>
            {editor.review ? '수정 완료' : '등록하기'}
          </Button>
        </>
      }
    >
      <form
        id={id}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSave(rating, comment.trim());
        }}
      >
        <div className={styles.summary}>
          <span className={styles.thumbnail} aria-hidden="true" />
          <div className={styles.bookingText}>
            <p className={styles.bookingName}>
              {editor.booking.photographerName} · {editor.booking.quoteName}
            </p>
            <p className={styles.date}>
              {formatShootDate(editor.booking.shootDate)}
            </p>
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
          <label htmlFor={`${id}-comment`}>리뷰 내용</label>
          <textarea
            id={`${id}-comment`}
            value={comment}
            onChange={(event) => {
              const textarea = event.currentTarget;
              const value = textarea.value.slice(0, 200);
              if (textarea.value.length > 200) textarea.value = value;
              setComment(value);
            }}
            maxLength={200}
            placeholder="촬영 분위기, 결과물 만족도 등을 자유롭게 남겨 주세요."
            aria-describedby={`${id}-count`}
          />
          <p id={`${id}-count`} className={styles.date}>
            {comment.length} / 200
          </p>
        </div>
      </form>
    </Modal>
  );
}
