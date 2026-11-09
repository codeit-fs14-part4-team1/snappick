import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(max-width: 1199px)';

const BREAKPOINTS = [
  { query: MOBILE_QUERY, columns: 2 },
  { query: TABLET_QUERY, columns: 3 },
];

function getColumnCount(desktopColumns: number): number {
  const matched = BREAKPOINTS.find(
    ({ query }) => window.matchMedia(query).matches,
  );
  return matched ? matched.columns : desktopColumns;
}

function getServerSnapshot(): null {
  return null;
}

//열 수와 무관 → 훅 바깥에 두어 렌더마다 재구독되지 않게
function subscribe(onChange: () => void) {
  const lists = BREAKPOINTS.map(({ query }) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener('change', onChange));
  return () => {
    lists.forEach((list) => list.removeEventListener('change', onChange));
  };
}

//브라우저의 미디어 쿼리 상태 sync
export function useColumnCount(desktopColumns: number) {
  const getSnapshot = () => getColumnCount(desktopColumns);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
