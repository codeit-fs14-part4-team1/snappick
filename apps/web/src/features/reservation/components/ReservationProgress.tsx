import type { ReservationStatus } from '@snappick/shared';
import { formatDateWithWeekday } from '@/utils/dateTime';

import styles from './ReservationProgress.module.css';

// 예약 상세에서 표시할 진행 단계
const RESERVATION_STEPS = [
  { status: 'CONFIRMED', label: '예약 확정' },
  { status: 'SHOOT_COMPLETED', label: '촬영 완료' },
  { status: 'DELIVERED', label: '결과물 전달' },
  { status: 'PURCHASE_CONFIRMED', label: '구매 확정' },
] as const;

type ReservationProgressProps = {
  status: ReservationStatus;
  createdAt: string;
  shootAt: string;
  deliveredAt: string | null;
  purchaseConfirmedAt: string | null;
};

// 진행 단계의 날짜를 YYYY. MM. DD (요일) 형식으로 표시
function formatProgressDate(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = formatDateWithWeekday(value);

  return date ? date.replaceAll('.', '. ') : '-';
}

// 예약 상태에 따라 완료된 진행 단계와 날짜를 표시
export default function ReservationProgress({
  status,
  createdAt,
  shootAt,
  deliveredAt,
  purchaseConfirmedAt,
}: ReservationProgressProps) {
  const currentStepIndex = RESERVATION_STEPS.findIndex(
    (step) => step.status === status,
  );

  // 예약 취소 상태에서는 진행 표시줄을 표시하지 않음
  if (currentStepIndex === -1) {
    return null;
  }

  // 각 진행 단계에서 사용할 날짜
  const stepDates = {
    CONFIRMED: createdAt,
    SHOOT_COMPLETED: shootAt,
    DELIVERED: deliveredAt,
    PURCHASE_CONFIRMED: purchaseConfirmedAt,
  };

  return (
    <ol className={styles.progress} aria-label="예약 진행 단계">
      {RESERVATION_STEPS.map((step, index) => {
        const isCompleted = index <= currentStepIndex;
        const isCurrent = index === currentStepIndex;

        const className = [
          styles.step,
          isCompleted && styles.completed,
          isCurrent && styles.current,
        ]
          .filter(Boolean)
          .join(' ');

        const date = isCompleted ? stepDates[step.status] : null;

        return (
          <li
            key={step.status}
            className={className}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className={styles.bar} aria-hidden="true" />
            <span className={styles.label}>{step.label}</span>

            {/* 완료된 진행 단계의 날짜만 표시 */}
            <span className={styles.date}>{formatProgressDate(date)}</span>
          </li>
        );
      })}
    </ol>
  );
}
