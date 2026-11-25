'use client';

import { useId, useState } from 'react';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateWithWeekday } from '@/utils/dateTime';

import type { ReviewBooking } from '@/features/my/reviews/types';

import { useCreateReservationReview } from '../hooks/useReservationReview';

import styles from './ReservationReviewModal.module.css';

type ReservationReviewModalProps = {
  booking: ReviewBooking;
  onClose: () => void;
};

// 리뷰 별점 아이콘
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

// 예약 상세 페이지에서 리뷰를 작성하는 모달
export default function ReservationReviewModal({
  booking,
  onClose,
}: ReservationReviewModalProps) {
  const id = useId();
  const { showToast } = useToast();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const createMutation = useCreateReservationReview(booking.reservationId);

  const isSaving = createMutation.isPending;

  const displayedRating = rating === 0 ? (hoverRating ?? 0) : rating;

  // 별점과 리뷰 내용이 유효한 경우에만 등록 가능
  const canSubmit =
    !isSaving &&
    !createMutation.isSuccess &&
    rating >= 1 &&
    rating <= 5 &&
    comment.trim().length > 0 &&
    comment.length <= 200;

  // 저장 중에는 모달을 닫을 수 없도록 처리
  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  // 실제 리뷰 등록 API 요청
  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        rating,
        comment: comment.trim(),
      });

      showToast('리뷰를 저장했어요.');
      onClose();
    } catch {
      showToast('리뷰를 저장하지 못했어요. 다시 시도해 주세요.', 'error');
    }
  };

  return (
    <Modal
      open
      onClose={handleClose}
      closeOnEscape={!isSaving}
      closeOnBackdrop={!isSaving}
      title="리뷰 쓰기"
      className={styles.modal}
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            disabled={isSaving}
            onClick={handleClose}
          >
            취소
          </Button>

          <Button type="submit" size="lg" form={id} disabled={!canSubmit}>
            {isSaving ? '등록 중...' : '등록하기'}
          </Button>
        </>
      }
    >
      <form
        id={id}
        className={styles.form}
        aria-busy={isSaving}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {/* 리뷰를 작성할 예약 정보 */}
        <div className={styles.summary}>
          <span className={styles.thumbnail} aria-hidden="true" />

          <div className={styles.bookingText}>
            <p className={styles.bookingName}>
              {booking.photographerName}
              {booking.quoteName && ` · ${booking.quoteName}`}
            </p>

            {booking.shootDate && (
              <p className={styles.date}>
                {formatDateWithWeekday(booking.shootDate)}
              </p>
            )}
          </div>
        </div>

        {/* 별점 선택 */}
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
                  if (rating === 0) {
                    setHoverRating(score);
                  }
                }}
              >
                <input
                  type="radio"
                  name={`${id}-rating`}
                  value={score}
                  checked={rating === score}
                  disabled={isSaving}
                  onChange={() => setRating(score)}
                  aria-label={`${score}점`}
                />

                <ReviewStar filled={score <= displayedRating} />
              </label>
            ))}
          </div>

          {!rating && <p className={styles.date}>별점을 선택해 주세요</p>}
        </fieldset>

        {/* 리뷰 내용 입력 */}
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
              setComment(event.currentTarget.value.slice(0, 200));
            }}
            disabled={isSaving}
            maxLength={200}
            placeholder="촬영 분위기, 결과물 만족도 등을 자유롭게 남겨 주세요."
            aria-describedby={`${id}-count`}
          />
        </div>
      </form>
    </Modal>
  );
}
