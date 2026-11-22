import type { Metadata } from 'next';
import UserReservationList from '@/features/reservation/components/UserReservationList';

export const metadata: Metadata = { title: '예약 내역 | SnapPick' };

export default function ReservationsPage() {
  // 공통 메뉴와 페이지 제목은 상위 레이아웃에서 제공함
  // 일반 사용자 예약 목록 컴포넌트를 연결함
  return <UserReservationList />;
}
