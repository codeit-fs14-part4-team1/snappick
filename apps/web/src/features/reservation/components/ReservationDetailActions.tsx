import type { ReservationStatus } from '@snappick/shared';

import Button from '@/components/ui/Button';
import styles from './ReservationDetailActions.module.css';

type ReservationDetailActionsProps = {
  status: ReservationStatus;
  isPhotographer: boolean;
  canRequestCancel: boolean;
  onMoveToChat?: () => void;
  onRequestCancel?: () => void;
  onCancelReservation?: () => void;
};

// 예약 상태와 계정 유형에 따른 하단 버튼을 표시
export default function ReservationDetailActions({
  status,
  isPhotographer,
  canRequestCancel,
  onMoveToChat,
  onRequestCancel,
  onCancelReservation,
}: ReservationDetailActionsProps) {
  // 현재 구현된 예약 확정 상태의 취소 버튼 표시 조건을 유지
  const showCancelAction = status === 'CONFIRMED' && canRequestCancel;

  const className = [styles.actions, !showCancelAction && styles.singleAction]
    .filter(Boolean)
    .join(' ');

  return (
    <footer className={className}>
      {/* 예약과 연결된 기존 채팅방으로 이동 */}
      <Button
        variant="outline"
        size="md"
        fullWidth
        disabled={!onMoveToChat}
        onClick={onMoveToChat}
      >
        채팅으로 이동
      </Button>

      {/* 취소 가능한 예약에만 계정 유형별 취소 버튼 표시 */}
      {showCancelAction && (
        <Button
          variant="outline"
          size="md"
          fullWidth
          disabled={isPhotographer ? !onCancelReservation : !onRequestCancel}
          onClick={isPhotographer ? onCancelReservation : onRequestCancel}
        >
          {isPhotographer ? '예약 취소' : '취소 요청'}
        </Button>
      )}
    </footer>
  );
}
