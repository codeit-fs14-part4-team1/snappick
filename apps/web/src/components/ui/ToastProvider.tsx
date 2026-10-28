'use client';

// 토스트 상태와 자동 닫힘을 관리할 React 기능을 가져옴
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import Toast, { type ToastVariant } from './Toast';
import styles from './Toast.module.css';

// 토스트의 자동 닫힘 시간과 최대 표시 개수를 정의함
const DISPLAY_DURATION_MS = 3000;
const MAX_VISIBLE_TOASTS = 3;

// 화면에 표시할 토스트 데이터를 정의함
type ToastData = {
  id: number;
  message: string;
  variant: ToastVariant;
};

// 다른 컴포넌트에서 사용할 토스트 호출 함수를 정의함
type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

// 토스트 호출 함수를 공유할 Context를 생성함
const ToastContext = createContext<ToastContextValue | null>(null);

// 개별 토스트를 일정 시간 후 제거함
function ToastWithTimer({
  id,
  message,
  variant,
  onDismiss,
}: ToastData & { onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDismiss(id);
    }, DISPLAY_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);

  return <Toast message={message} variant={variant} />;
}

// 여러 페이지에서 사용할 토스트 상태를 관리함
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const nextToastId = useRef(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  // 최대 개수가 유지되는 상황에서도 새 토스트를 구분함
  const latestToastId = toasts[toasts.length - 1]?.id;

  // 지정한 토스트를 목록에서 제거함
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // 새로운 토스트를 목록에 추가하고 최대 개수를 유지함
  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = ++nextToastId.current;

      setToasts((current) =>
        [...current, { id, message, variant }].slice(-MAX_VISIBLE_TOASTS),
      );
    },
    [],
  );

  // 화면이 그려지기 전에 토스트의 Top Layer 표시 상태를 갱신함
  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    // Popover API 미지원 환경에서는 기존 일반 DOM 표시 방식을 사용함
    if (
      !viewport ||
      typeof viewport.showPopover !== 'function' ||
      typeof viewport.hidePopover !== 'function'
    ) {
      return;
    }

    const isPopoverOpen = viewport.matches(':popover-open');

    // 모든 토스트가 사라지면 팝오버도 닫음
    if (latestToastId === undefined) {
      if (isPopoverOpen) {
        viewport.hidePopover();
      }

      return;
    }

    // 새 토스트를 현재 열린 모달보다 위에 표시하도록 순서를 갱신함
    if (isPopoverOpen) {
      viewport.hidePopover();
    }

    viewport.showPopover();
  }, [latestToastId]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div ref={viewportRef} className={styles.viewport} popover="manual">
        {toasts.map((toast) => (
          <ToastWithTimer key={toast.id} {...toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// 다른 컴포넌트에서 토스트 호출 함수를 사용할 수 있도록 함
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast는 ToastProvider 내부에서 사용해야 합니다.');
  }

  return context;
}
