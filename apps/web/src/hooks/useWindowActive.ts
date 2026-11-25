import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('focus', onChange);
  window.addEventListener('blur', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    window.removeEventListener('blur', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

export default function useWindowActive() {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === 'visible' && document.hasFocus(),
    () => false,
  );
}
