import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(max-width: 1199px)';

function getSnapshot(): number {
  if (window.matchMedia(MOBILE_QUERY).matches) return 2;
  if (window.matchMedia(TABLET_QUERY).matches) return 3;
  return 5;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(onChange: () => void) {
  const mobile = window.matchMedia(MOBILE_QUERY);
  const tablet = window.matchMedia(TABLET_QUERY);
  mobile.addEventListener('change', onChange);
  tablet.addEventListener('change', onChange);
  return () => {
    mobile.removeEventListener('change', onChange);
    tablet.removeEventListener('change', onChange);
  };
}

export function useColumnCount() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
