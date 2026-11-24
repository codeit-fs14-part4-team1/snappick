'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useCreateReservationCancel } from '../hooks/useReservationCancel';
import { formatDateWithWeekday, formatTime } from '@/utils/dateTime';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

import styles from './ReservationCancelModal.module.css';

type CancelReason = 'SCHEDULE_CHANGE' | 'PERSONAL_REASON' | 'WEATHER' | 'OTHER';

type ReservationCancelRequestModalProps = {
  reservationId: string;
  open: boolean;
  onClose: () => void;
  photographerName: string;
  shootAt: string;
  location: string;
};

const CANCEL_REASONS: {
  value: CancelReason;
  label: string;
}[] = [
  { value: 'SCHEDULE_CHANGE', label: '일정 변경' },
  { value: 'PERSONAL_REASON', label: '개인 사정' },
  { value: 'WEATHER', label: '날씨' },
  { value: 'OTHER', label: '기타 (직접 입력)' },
];

function formatSchedule(value: string) {
  const date = formatDateWithWeekday(value);
  const time = formatTime(value);

  if (!date || !time) {
    return '일정 확인 필요';
  }

  return `${date} ${time}`;
}

// 일반 사용자의 예약 취소 요청 모달
export default function ReservationCancelRequestModal({
  reservationId,
  open,
  onClose,
  photographerName,
  shootAt,
  location,
}: ReservationCancelRequestModalProps) {
  const { showToast } = useToast();

  const [selectedReason, setSelectedReason] =
    useState<CancelReason>('SCHEDULE_CHANGE');

  const [customReason, setCustomReason] = useState('');

  const cancelMutation = useCreateReservationCancel(reservationId);

  const isSubmitting = cancelMutation.isPending;

  // 선택한 취소 사유를 서버에 전달할 문자열로 변환
  const reason =
    selectedReason === 'OTHER'
      ? customReason.trim()
      : (CANCEL_REASONS.find((option) => option.value === selectedReason)
          ?.label ?? '');

  // 유효한 취소 사유가 있는 경우에만 요청 가능
  const canSubmit =
    !isSubmitting &&
    !cancelMutation.isSuccess &&
    reason.length > 0 &&
    reason.length <= 1000;

  // 모달의 입력값과 요청 상태 초기화
  const resetForm = () => {
    setSelectedReason('SCHEDULE_CHANGE');
    setCustomReason('');
    cancelMutation.reset();
  };

  // 요청 중에는 모달을 닫을 수 없도록 처리
  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    resetForm();
    onClose();
  };

  // 일반 사용자의 실제 예약 취소 요청
  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      await cancelMutation.mutateAsync({ reason });

      showToast('예약 취소를 요청했어요.');

      resetForm();
      onClose();
    } catch {
      showToast('예약 취소 요청에 실패했어요. 다시 시도해 주세요.', 'error');
    }
  };

  return (
    <Modal
      className={styles.cancelModal}
      open={open}
      onClose={handleClose}
      closeOnEscape={!isSubmitting}
      closeOnBackdrop={!isSubmitting}
      title="예약 취소를 요청할까요?"
      footer={
        <>
          <Button
            variant="outline"
            size="md"
            disabled={isSubmitting}
            onClick={handleClose}
          >
            닫기
          </Button>

          <Button
            variant="danger"
            size="md"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? '요청 중...' : '취소 요청하기'}
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        {/* 예약 요약 */}
        <p className={styles.reservationSummary}>
          {photographerName} ·{' '}
          <time dateTime={shootAt}>{formatSchedule(shootAt)}</time>
          {' · '}
          {location}
        </p>

        {/* 취소 사유 선택 */}
        <fieldset className={styles.reasonFieldset} disabled={isSubmitting}>
          <legend className={styles.reasonLegend}>취소 사유</legend>

          <div className={styles.reasonOptions}>
            {CANCEL_REASONS.map((option) => (
              <label
                key={option.value}
                className={[
                  styles.reasonOption,
                  selectedReason === option.value && styles.selected,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <input
                  type="radio"
                  name="userReservationCancelReason"
                  value={option.value}
                  checked={selectedReason === option.value}
                  onChange={() => setSelectedReason(option.value)}
                  className={styles.reasonRadio}
                />

                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 기타 선택 시 직접 입력 */}
        {selectedReason === 'OTHER' && (
          <textarea
            className={styles.customReason}
            value={customReason}
            onChange={(event) => setCustomReason(event.target.value)}
            placeholder="‘기타’를 선택하면 사유를 직접 입력해요."
            aria-label="기타 취소 사유"
            maxLength={1000}
            rows={3}
            disabled={isSubmitting}
          />
        )}

        {/* 취소 및 환불 안내 */}
        <section className={styles.refundPolicy} aria-label="취소 및 환불 규정">
          <h3 className={styles.refundTitle}>취소·환불 규정</h3>

          <ul className={styles.refundList}>
            <li>촬영 7일 전까지 취소: 전액 환불</li>
            <li>촬영 3~6일 전 취소: 결제 금액의 30%를 공제하고 환불</li>
            <li>촬영 2일 전 ~ 당일 취소: 환불 불가</li>
            <li>작가 사정으로 취소되면 전액 환불돼요.</li>
          </ul>
        </section>
      </div>
    </Modal>
  );
}
