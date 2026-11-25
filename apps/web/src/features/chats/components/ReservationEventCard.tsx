import Link from 'next/link';
import buttonStyles from '@/components/ui/Button.module.css';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  formatDate,
  formatDateWithWeekday,
  formatTime,
} from '@/utils/dateTime';
import type { ChatReservation, ChatReservationEvent } from '../types';
import styles from './ReservationEventCard.module.css';

const eventCopy = {
  RESERVATION_CONFIRMED: {
    label: '예약 확정',
    title: '예약이 확정됐어요',
    variant: 'confirmed',
  },
  RESERVATION_CANCELED: {
    label: '예약 취소',
    title: '예약이 취소됐어요',
    variant: 'canceled',
  },
  RESERVATION_CANCEL_REQUESTED: {
    label: '취소 요청 접수',
    title: '예약 취소를 요청했어요',
    variant: 'cancelRequested',
  },
  RESERVATION_CANCEL_REJECTED: {
    label: '취소 요청 반려',
    title: '예약 취소 요청이 반려됐어요',
    variant: 'canceled',
  },
  RESERVATION_DELIVERED: {
    label: '결과물 전달',
    title: '결과물이 전달됐어요',
    variant: 'delivered',
  },
} as const;

export default function ReservationEventCard({
  reservation,
  now,
}: {
  reservation: ChatReservation & { event: ChatReservationEvent };
  now: string;
}) {
  const { label, title, variant } = eventCopy[reservation.event];
  const isDelivery = reservation.event === 'RESERVATION_DELIVERED';
  const days = Math.round(
    (Date.parse(formatDate(reservation.shootAt).replaceAll('.', '-')) -
      Date.parse(formatDate(now).replaceAll('.', '-'))) /
      86400000,
  );
  return (
    <article className={styles.card} aria-label={`${label} 안내`}>
      <header className={styles.header}>
        <StatusBadge variant={variant}>{label}</StatusBadge>
        {reservation.event === 'RESERVATION_CONFIRMED' &&
          Number.isFinite(days) &&
          days >= 0 && (
            <span className={styles.countdown}>
              {days === 0 ? 'D-day' : `D-${days}`}
            </span>
          )}
      </header>
      <div className={styles.heading}>
        <h3>{title}</h3>
        <p>{reservation.quoteName ?? '촬영 예약'}</p>
      </div>
      {!isDelivery && (
        <dl className={styles.details}>
          <div>
            <dt>촬영 일시</dt>
            <dd>
              {formatDateWithWeekday(reservation.shootAt)}{' '}
              {formatTime(reservation.shootAt)}
            </dd>
          </div>
          <div>
            <dt>촬영 장소</dt>
            <dd>{reservation.location}</dd>
          </div>
          <div>
            <dt>결제 금액</dt>
            <dd>{reservation.amount.toLocaleString('ko-KR')}원</dd>
          </div>
        </dl>
      )}
      <Link
        className={`${buttonStyles.button} ${buttonStyles.outline} ${buttonStyles.md} ${buttonStyles.fullWidth} ${styles.detailAction}`}
        href={`/my/reservations/${encodeURIComponent(reservation.id)}`}
      >
        {isDelivery ? '결과물 확인하러 가기' : '예약 상세 보기'}
      </Link>
    </article>
  );
}
