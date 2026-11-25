'use client';

import { useState } from 'react';
import { formatDateWithWeekday, formatTime } from '@/utils/dateTime';
import { useToast } from '@/components/ui/ToastProvider';

import {
  useCreateReservationCancel,
  useUpdateReservationCancel,
} from '../hooks/useReservationCancel';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

import styles from './ReservationCancelModal.module.css';

type CancelReason =
  'CUSTOMER_REQUEST' | 'PHOTOGRAPHER_REASON' | 'WEATHER' | 'OTHER';

type ReservationCancelModalProps = {
  reservationId: string;
  cancelRequestId?: string;
  open: boolean;
  onClose: () => void;
  customerName: string;
  shootAt: string;
  location: string;
  requestedAt?: string | null;
  requestReason?: string | null;
};

const CANCEL_REASONS: {
  value: CancelReason;
  label: string;
}[] = [
  { value: 'CUSTOMER_REQUEST', label: '고객 요청' },
  { value: 'PHOTOGRAPHER_REASON', label: '작가 사정' },
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

// 사진작가의 직접 예약 취소 및 고객 취소 요청 수락 모달
export default function ReservationCancelModal({
  reservationId,
  cancelRequestId,
  open,
  onClose,
  customerName,
  shootAt,
  location,
  requestedAt,
  requestReason,
}: ReservationCancelModalProps) {
  const { showToast } = useToast();

  const [selectedReason, setSelectedReason] = useState<CancelReason | null>(
    null,
  );

  const [customReason, setCustomReason] = useState('');

  const createCancelMutation = useCreateReservationCancel(reservationId);

  const updateCancelMutation = useUpdateReservationCancel(reservationId);

  // 직접 취소 또는 고객 취소 요청 수락 처리 여부
  const isSubmitting =
    createCancelMutation.isPending || updateCancelMutation.isPending;

  // 선택한 사유를 실제 서버 전송 문자열로 변환
  const reason =
    selectedReason === 'OTHER'
      ? customReason.trim()
      : (CANCEL_REASONS.find((option) => option.value === selectedReason)
          ?.label ?? '');

  // 취소 사유 입력 및 중복 요청 방지
  const canSubmit =
    !isSubmitting &&
    !createCancelMutation.isSuccess &&
    !updateCancelMutation.isSuccess &&
    reason.length > 0 &&
    reason.length <= 1000;

  // 모달 입력값 및 요청 상태 초기화
  const resetForm = () => {
    setSelectedReason(null);
    setCustomReason('');
    createCancelMutation.reset();
    updateCancelMutation.reset();
  };

  // 요청 중 모달 닫기 방지
  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    resetForm();
    onClose();
  };

  // 사진작가의 예약 취소 확정
  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      if (cancelRequestId) {
        // 고객이 요청한 예약 취소를 수락
        await updateCancelMutation.mutateAsync({
          cancelRequestId,
          input: {
            status: 'ACCEPTED',
            reason,
          },
        });
      } else {
        // 사진작가가 직접 예약 취소
        await createCancelMutation.mutateAsync({
          reason,
        });
      }

      showToast('예약이 취소되었어요.');

      resetForm();
      onClose();
    } catch {
      showToast('예약 취소에 실패했어요. 다시 시도해 주세요.', 'error');
    }
  };

  return (
    <Modal
      className={styles.cancelModal}
      open={open}
      onClose={handleClose}
      closeOnEscape={!isSubmitting}
      closeOnBackdrop={!isSubmitting}
      title="예약을 취소할까요?"
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
            {isSubmitting ? '처리 중...' : '예약 취소 확정'}
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        {/* 예약 요약 */}
        <p className={styles.reservationSummary}>
          {customerName} ·{' '}
          <time dateTime={shootAt}>{formatSchedule(shootAt)}</time>
          {' · '}
          {location}
        </p>

        {/* 고객의 기존 취소 요청 */}
        {requestedAt && (
          <div className={styles.requestBox}>
            <strong className={styles.requestTitle}>
              {customerName}님의 취소 요청 ·{' '}
              <time dateTime={requestedAt}>{formatSchedule(requestedAt)}</time>
            </strong>

            <p className={styles.requestReason}>
              요청 사유: {requestReason || '사유 없음'}
            </p>
          </div>
        )}

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
                  name="reservationCancelReason"
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

        {/* 기타 취소 사유 직접 입력 */}
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

        {/* 취소·환불 규정 안내 */}
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
