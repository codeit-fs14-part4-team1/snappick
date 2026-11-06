'use client';

// 비회원이 로그인이 필요한 동작을 했을 때 띄우는 안내 모달을 전역에서 관리함
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

import GuestLoginModal from './GuestLoginModal';

// 다른 컴포넌트에 나눠줄 호출 함수
type GuestLoginContextValue = {
  openGuestLoginModal: () => void;
};

const GuestLoginContext = createContext<GuestLoginContextValue | null>(null);

export function GuestLoginProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openGuestLoginModal = useCallback(() => {
    setOpen(true);
  }, []);

  const closeGuestLoginModal = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <GuestLoginContext.Provider value={{ openGuestLoginModal }}>
      {children}
      <GuestLoginModal open={open} onClose={closeGuestLoginModal} />
    </GuestLoginContext.Provider>
  );
}

// 카드·문의하기·저장 등에서 호출: const { openGuestLoginModal } = useGuestLoginModal();
export function useGuestLoginModal() {
  const context = useContext(GuestLoginContext);

  if (!context)
    throw new Error(
      'useGuestLoginModal은 GuestLoginProvider 내부에서 사용해야 합니다.',
    );

  return context;
}
