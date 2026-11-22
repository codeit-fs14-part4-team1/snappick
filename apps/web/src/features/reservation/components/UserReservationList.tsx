'use client';

import { useState } from 'react';
import { useMyPageAccount } from '@/features/my/components/MyPageLayout';
import { useMyReservations } from '../hooks/useMyReservations';
import type { ReservationListFilter } from '../types';

import Pagination from '@/components/ui/Pagination';
import StateMessage from '@/components/ui/StateMessage';
import ReservationCard from './ReservationCard';

import UserReservationTabs, {
  type UserReservationTab,
} from './UserReservationTabs';

// 한 페이지에 표시할 예약 개수를 정의
const PAGE_SIZE = 10;

// 예약 상태별 전체 건수를 조회하고 탭에 표시함
function UserReservationTabsWithCounts({
  selectedTab,
  onTabChange,
}: {
  selectedTab: UserReservationTab;
  onTabChange: (tab: UserReservationTab) => void;
}) {
  // 예정 예약의 전체 건수를 조회함
  const { data: scheduledData } = useMyReservations({
    type: 'UPCOMING',
    page: 1,
    pageSize: PAGE_SIZE,
  });

  // 진행 중인 예약의 전체 건수를 조회함
  const { data: inProgressData } = useMyReservations({
    type: 'IN_PROGRESS',
    page: 1,
    pageSize: PAGE_SIZE,
  });

  // 완료된 예약의 전체 건수를 조회함
  const { data: completedData } = useMyReservations({
    type: 'COMPLETED',
    page: 1,
    pageSize: PAGE_SIZE,
  });

  // 취소된 예약의 전체 건수를 조회함
  const { data: canceledData } = useMyReservations({
    type: 'CANCELED',
    page: 1,
    pageSize: PAGE_SIZE,
  });

  // 조회에 성공한 예약 상태의 전체 건수만 전달함
  const counts: Partial<Record<UserReservationTab, number>> = {};

  if (scheduledData) {
    counts.scheduled = scheduledData.totalCount;
  }

  if (inProgressData) {
    counts.inProgress = inProgressData.totalCount;
  }

  if (completedData) {
    counts.completed = completedData.totalCount;
  }

  if (canceledData) {
    counts.canceled = canceledData.totalCount;
  }

  return (
    <UserReservationTabs
      selectedTab={selectedTab}
      onTabChange={onTabChange}
      counts={counts}
    />
  );
}

// 일반 사용자의 예약 목록을 조회하고 표시
function UserReservationContent({
  selectedTab,
}: {
  selectedTab: UserReservationTab | null;
}) {
  const [page, setPage] = useState(1);

  // 선택한 탭을 서버에서 지원하는 예약 필터로 변환함
  const filterType: ReservationListFilter =
    selectedTab === 'scheduled'
      ? 'UPCOMING'
      : selectedTab === 'inProgress'
        ? 'IN_PROGRESS'
        : selectedTab === 'completed'
          ? 'COMPLETED'
          : 'CANCELED';

  // 선택한 예약 상태와 페이지에 따라 목록을 조회함
  const { data, isPending, isError, refetch } = useMyReservations({
    type: filterType,
    page,
    pageSize: PAGE_SIZE,
  });

  // 예약 목록 조회 중 로딩 상태를 표시
  if (isPending) {
    return (
      <StateMessage title="예약 내역을 불러오는 중이에요." role="status" />
    );
  }

  // 예약 목록 조회 실패 시 재시도 버튼을 표시
  if (isError) {
    return (
      <StateMessage
        title="예약 내역을 불러오지 못했어요."
        description="잠시 후 다시 시도해 주세요."
        role="alert"
        button={{
          label: '다시 시도',
          onClick: () => {
            void refetch();
          },
        }}
      />
    );
  }

  // 선택한 예약 상태에 따라 빈 목록 안내를 표시함
  if (!data || data.totalCount === 0) {
    if (selectedTab === 'completed') {
      return <StateMessage title="완료 된 건이 없어요." />;
    }

    if (selectedTab === 'canceled') {
      return <StateMessage title="취소 된 건이 없어요." />;
    }

    if (selectedTab === 'inProgress') {
      return <StateMessage title="진행 중인 건이 없어요." />;
    }

    return (
      <StateMessage
        title="예정 된 내역이 없어요."
        description="작가에게 문의하고 견적을 결제하면 여기에 보여요."
        link={{
          label: '작가 찾아보기',
          href: '/',
        }}
      />
    );
  }

  // 현재 페이지에 표시할 예약이 없는 경우를 처리
  if (data.items.length === 0) {
    return (
      <StateMessage
        title="현재 페이지에 표시할 예약이 없어요."
        button={{
          label: '첫 페이지로',
          onClick: () => setPage(1),
        }}
      />
    );
  }

  return (
    <section aria-label="내 예약 목록">
      {/* 서버에서 조회한 예약 목록을 표시 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {data.items.map((reservation) => (
          <ReservationCard
            key={reservation.reservationId}
            reservation={reservation}
          />
        ))}
      </div>

      {/* 예약이 여러 페이지에 걸쳐 있는 경우 페이지 이동을 제공 */}
      {data.totalPages > 1 && (
        <div style={{ marginTop: 32 }}>
          <Pagination
            currentPage={page}
            totalPages={data.totalPages}
            onPageChange={setPage}
            aria-label="예약 목록 페이지 이동"
          />
        </div>
      )}
    </section>
  );
}

// 일반 사용자에게만 예약 목록을 표시함
export default function UserReservationList() {
  const { accountType } = useMyPageAccount();

  // 예정 탭을 기본 선택 상태로 설정함
  const [selectedTab, setSelectedTab] =
    useState<UserReservationTab>('scheduled');

  if (accountType !== 'USER') {
    return null;
  }

  return (
    <section aria-label="내 예약 목록">
      {/* 예약 상태 탭과 실제 예약 건수를 표시함 */}
      <UserReservationTabsWithCounts
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
      />

      {/* 선택한 탭의 예약 목록을 실제 API 데이터로 표시함 */}
      <div style={{ marginTop: 20 }}>
        <UserReservationContent key={selectedTab} selectedTab={selectedTab} />
      </div>
    </section>
  );
}
