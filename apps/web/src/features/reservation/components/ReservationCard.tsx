import Image from 'next/image';

import { ReservationStatusLabel } from '@/constants/enum-labels';
import { formatDateWithWeekday, formatTime } from '@/utils/dateTime';
import type { ReservationListItem } from '../types';
import { formatReservationDDay } from '../utils/formatReservationDDay';

import StatusBadge from '@/components/ui/StatusBadge';
import styles from './ReservationCard.module.css';

// 예약 카드 컴포넌트 Props를 정의
type ReservationCardProps = {
  reservation: ReservationListItem;
};

// 예약 상태를 공통 StatusBadge의 variant로 변환함
const reservationStatusBadgeVariants = {
  CONFIRMED: 'confirmed',
  SHOOT_COMPLETED: 'shootCompleted',
  DELIVERED: 'delivered',
  PURCHASE_CONFIRMED: 'purchaseConfirmed',
  CANCELED: 'canceled',
} as const;

// 공통 날짜 유틸을 사용해 촬영 일정을 표시함
function formatShootAt(value: string): string {
  const date = formatDateWithWeekday(value);
  const time = formatTime(value);

  if (!date || !time) {
    return '촬영 일정 확인 필요';
  }

  return `${date} ${time}`;
}

// 예약 목록의 개별 예약 정보를 표시
export default function ReservationCard({ reservation }: ReservationCardProps) {
  const {
    name,
    counterpart,
    status,
    cancelRequestStatus,
    shootAt,
    location,
    totalAmount,
  } = reservation;

  // 예약 확정 상태에서만 촬영일까지 남은 날짜를 표시함
  const dDay = status === 'CONFIRMED' ? formatReservationDDay(shootAt) : null;

  // 예약 확정 상태에서 취소 요청이 대기 중인지 확인함
  const isCancelRequested =
    status === 'CONFIRMED' && cancelRequestStatus === 'PENDING';

  return (
    <article className={styles.card}>
      {/* 예약 진행 상태와 촬영일까지 남은 날짜를 표시함 */}
      <div className={styles.statusRow}>
        <StatusBadge variant={reservationStatusBadgeVariants[status]}>
          {ReservationStatusLabel[status]}
        </StatusBadge>

        {/* 취소 요청이 대기 중인 예약에 별도 배지를 표시함 */}
        {isCancelRequested && (
          <StatusBadge variant="cancelRequested">취소 요청 중</StatusBadge>
        )}

        {dDay && <span className={styles.dDay}>{dDay}</span>}
      </div>

      {/* 예약명을 표시함 */}
      <h2 className={styles.title}>{name ?? '예약명 없음'}</h2>

      {/* 촬영 날짜, 장소 및 예약 금액을 표시함 */}
      <p className={styles.details}>
        <time dateTime={shootAt}>{formatShootAt(shootAt)}</time>
        {' · '}
        {location}
        {' · '}
        {totalAmount.toLocaleString('ko-KR')}원
      </p>

      {/* 예약 상대방의 프로필 정보를 표시함 */}
      <div className={styles.counterpart}>
        {counterpart?.profileImageUrl ? (
          <Image
            src={counterpart.profileImageUrl}
            alt=""
            width={32}
            height={32}
            className={styles.avatar}
            unoptimized
          />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true" />
        )}
        <strong className={styles.counterpartName}>
          {counterpart?.nickname ?? '상대방 정보 없음'}
        </strong>
      </div>

      {/* 예약 상세 페이지 이동을 나타내는 화살표 UI */}
      <span className={styles.detailArrow} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 6L15 12L9 18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </article>
  );
}
