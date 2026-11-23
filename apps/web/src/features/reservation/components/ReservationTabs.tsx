import styles from './ReservationTabs.module.css';

// 예약 목록 화면에서 사용하는 탭 정의
const RESERVATION_TABS = [
  { key: 'scheduled', label: '예정' },
  { key: 'inProgress', label: '진행' },
  { key: 'completed', label: '완료' },
  { key: 'canceled', label: '취소' },
] as const;

// 예약 목록 화면의 탭 타입 정의
export type ReservationTab = (typeof RESERVATION_TABS)[number]['key'];

type ReservationTabsProps = {
  // 전체 예약 조회 시 선택된 상태 탭이 없도록 처리함
  selectedTab: ReservationTab | null;
  onTabChange: (tab: ReservationTab) => void;

  // 서버에서 확인된 탭별 예약 개수만 표시함
  counts?: Partial<Record<ReservationTab, number>>;

  // 사용할 수 없는 탭을 비활성화할 수 있도록 함
  disabledTabs?: Partial<Record<ReservationTab, boolean>>;
};

// 일반 사용자 예약 목록의 상태 탭을 표시
export default function ReservationTabs({
  selectedTab,
  onTabChange,
  counts,
  disabledTabs,
}: ReservationTabsProps) {
  return (
    <div className={styles.tabs} role="group" aria-label="예약 상태 선택">
      {RESERVATION_TABS.map((tab) => {
        const isSelected = selectedTab === tab.key;
        const isDisabled = disabledTabs?.[tab.key] ?? false;
        const count = counts?.[tab.key];

        return (
          <button
            key={tab.key}
            type="button"
            className={styles.tab}
            aria-pressed={isSelected}
            disabled={isDisabled}
            onClick={() => onTabChange(tab.key)}
          >
            <span>{tab.label}</span>

            {/* 실제 예약 개수가 확인된 경우에만 표시*/}
            {count !== undefined && (
              <span>{count.toLocaleString('ko-KR')}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
