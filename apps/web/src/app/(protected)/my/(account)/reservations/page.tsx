import type { Metadata } from 'next';
import { Suspense } from 'react';

import ReservationList from '@/features/reservation/components/ReservationList';
import StateMessage from '@/components/ui/StateMessage';

export const metadata: Metadata = { title: '예약 내역 | SnapPick' };

export default function ReservationsPage() {
  // 공통 메뉴와 페이지 제목은 상위 레이아웃에서 제공함
  // 일반 사용자와 사진작가의 공통 예약 목록 컴포넌트를 연결함
  return (
    <Suspense
      fallback={
        <StateMessage title="예약 내역을 불러오는 중이에요." role="status" />
      }
    >
      <ReservationList />
    </Suspense>
  );
}
