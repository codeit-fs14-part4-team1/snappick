'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMyPageAccount } from '@/features/my/components/MyPageLayout';
import { useMyReservations } from '../hooks/useMyReservations';
import type { ReservationListFilter } from '../types';

import Pagination from '@/components/ui/Pagination';
import StateMessage from '@/components/ui/StateMessage';
import ReservationCard from './ReservationCard';

import ReservationTabs, { type ReservationTab } from './ReservationTabs';

// 한 페이지에 표시할 예약 개수를 정의
const PAGE_SIZE = 10;

// 예약 화면의 탭을 서버에서 지원하는 필터로 변환
const TAB_FILTERS: Record<ReservationTab, ReservationListFilter> = {
  scheduled: 'UPCOMING',
  inProgress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  canceled: 'CANCELED',
};

// URL의 예약 필터를 화면에서 사용하는 탭으로 변환
function getSelectedTab(value: string | null): ReservationTab {
  switch (value) {
    case 'IN_PROGRESS':
      return 'inProgress';

    case 'COMPLETED':
      return 'completed';

    case 'CANCELED':
      return 'canceled';

    case 'UPCOMING':
    default:
      return 'scheduled';
  }
}

// URL의 페이지 번호를 확인하고 잘못된 값은 첫 페이지로 처리
function getSelectedPage(value: string | null): number {
  const page = Number(value);

  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

// 예약 상태별 전체 건수를 조회하고 탭에 표시함
function ReservationTabsWithCounts({
  selectedTab,
  onTabChange,
}: {
  selectedTab: ReservationTab;
  onTabChange: (tab: ReservationTab) => void;
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
  const counts: Partial<Record<ReservationTab, number>> = {};

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
    <ReservationTabs
      selectedTab={selectedTab}
      onTabChange={onTabChange}
      counts={counts}
    />
  );
}

// 일반 사용자와 사진작가의 예약 목록을 조회하고 표시
function ReservationContent({
  selectedTab,
  page,
  onPageChange,
}: {
  selectedTab: ReservationTab;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { accountType } = useMyPageAccount();

  // 선택한 탭을 서버에서 지원하는 예약 필터로 변환
  const filterType = TAB_FILTERS[selectedTab];

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

    // 사진작가 계정은 일반 사용자용 결제 안내를 표시하지 않음
    if (accountType === 'PHOTOGRAPHER') {
      return <StateMessage title="예정 된 내역이 없어요." />;
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
          onClick: () => onPageChange(1),
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
            onPageChange={onPageChange}
            aria-label="예약 목록 페이지 이동"
          />
        </div>
      )}
    </section>
  );
}
// 일반 사용자와 사진작가의 공통 예약 목록을 표시
export default function ReservationList() {
  const { accountType } = useMyPageAccount();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL을 기준으로 현재 선택한 탭과 페이지를 확인
  const selectedTab = getSelectedTab(searchParams.get('tab'));
  const page = getSelectedPage(searchParams.get('page'));

  // 선택한 예약 탭을 URL에 반영하고 첫 페이지로 이동
  const handleTabChange = (tab: ReservationTab) => {
    if (tab === selectedTab) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    params.set('tab', TAB_FILTERS[tab]);
    params.delete('page');

    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  // 선택한 페이지 번호를 URL에 반영
  const handlePageChange = (nextPage: number) => {
    if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage === page) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    params.set('tab', TAB_FILTERS[selectedTab]);

    if (nextPage === 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }

    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  // 일반 사용자와 사진작가 계정에서 예약 목록을 표시
  if (accountType !== 'USER' && accountType !== 'PHOTOGRAPHER') {
    return null;
  }

  return (
    <section aria-label="내 예약 목록">
      {/* 예약 상태 탭과 실제 예약 건수를 표시 */}
      <ReservationTabsWithCounts
        selectedTab={selectedTab}
        onTabChange={handleTabChange}
      />

      {/* 선택한 탭과 페이지의 예약 목록을 표시 */}
      <div style={{ marginTop: 20 }}>
        <ReservationContent
          key={selectedTab}
          selectedTab={selectedTab}
          page={page}
          onPageChange={handlePageChange}
        />
      </div>
    </section>
  );
}
