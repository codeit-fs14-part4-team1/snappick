import type { Metadata } from 'next';

export const metadata: Metadata = { title: '예약 내역 | SnapPick' };

export default function ReservationsPage() {
  // 공통 메뉴·페이지 제목은 상위 layout.tsx에서 제공합니다.
  // 예약 담당자는 이곳에 예약 목록 콘텐츠를 연결합니다.
  // 하위 클라이언트 컴포넌트에서 useMyPageAccount().accountType으로
  // USER의 예약 조회 / PHOTOGRAPHER의 예약 관리를 구분합니다.
  return null;
}
