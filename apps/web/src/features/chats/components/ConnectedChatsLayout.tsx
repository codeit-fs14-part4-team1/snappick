'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getChatRooms } from '../api';
import useChatRooms from '../useChatRooms';
import type { ChatRoomListLoader, ChatRoomSummary } from '../types';
import ChatsLayout from './ChatsLayout';
import styles from './ChatsLayout.module.css';

type ChatRoomsContextValue = {
  rooms: ChatRoomSummary[];
  now: string;
  isLoading: boolean;
  isError: boolean;
};
const ChatRoomsContext = createContext<ChatRoomsContextValue | null>(null);

export function useConnectedChatRooms() {
  const value = useContext(ChatRoomsContext);
  if (!value)
    throw new Error('문의 목록 연결 컴포넌트 내부에서 사용해야 합니다.');
  return value;
}

export default function ConnectedChatsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, authStatus, accessToken, clearAuth } = useAuth();
  const selectedRoomId = useSelectedLayoutSegment();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const updateNow = () => setNow(new Date());
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateNow();
    };
    const frame = requestAnimationFrame(updateNow);
    const interval = window.setInterval(updateNow, 60_000);
    window.addEventListener('focus', updateNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener('focus', updateNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [authStatus]);

  const refreshedToken = useRef<{ sourceToken: string; token: string } | null>(
    null,
  );
  const loadPage = useCallback<ChatRoomListLoader>(
    async (params) => {
      if (!accessToken) throw new Error('로그인이 필요합니다.');
      const token =
        refreshedToken.current?.sourceToken === accessToken
          ? refreshedToken.current.token
          : accessToken;
      try {
        return await getChatRooms(params, {
          accessToken: token,
          onTokenRefresh: (newToken) => {
            if (!params.signal?.aborted)
              refreshedToken.current = {
                sourceToken: accessToken,
                token: newToken,
              };
          },
        });
      } catch (error) {
        if (
          !params.signal?.aborted &&
          error instanceof Error &&
          error.message === 'API 요청 실패: 401'
        )
          clearAuth();
        throw error;
      }
    },
    [accessToken, clearAuth],
  );
  const query = useChatRooms({
    accountId:
      authStatus === 'authenticated' && accessToken ? (user?.id ?? null) : null,
    loadPage,
  });

  if (authStatus === 'initializing')
    return <p role="status">로그인 정보를 확인하고 있어요.</p>;
  if (authStatus === 'error')
    return (
      <section className={styles.empty} role="alert">
        <h2>로그인 정보를 확인하지 못했어요</h2>
        <button
          type="button"
          className={styles.exploreLink}
          onClick={() => window.location.reload()}
        >
          다시 시도
        </button>
      </section>
    );
  if (!user || authStatus !== 'authenticated')
    return (
      <section className={styles.empty}>
        <h2>로그인이 필요해요</h2>
        <p>로그인 후 문의 내역을 확인할 수 있어요.</p>
        <Link className={styles.exploreLink} href="/login">
          로그인
        </Link>
      </section>
    );

  const role = user.accountType === 'PHOTOGRAPHER' ? 'photographer' : 'user';
  return (
    <ChatRoomsContext.Provider
      value={{
        rooms: query.rooms,
        now: now.toISOString(),
        isLoading: query.isPending,
        isError: query.isError,
      }}
    >
      <ChatsLayout
        accountId={user.id}
        selectedRoomId={selectedRoomId}
        listProps={{
          rooms: query.rooms,
          role,
          now,
          getRoomHref: (id) => `/chats/${encodeURIComponent(id)}`,
          isLoading: query.isPending,
          isError: query.isError,
          hasNextPage: query.hasNextPage,
          isFetchingNextPage: query.isFetchingNextPage,
          isFetchNextPageError: query.isFetchNextPageError,
          onRetry: () => {
            void query.refetch();
          },
          onLoadMore: () => {
            if (query.hasNextPage && !query.isFetching)
              void query.fetchNextPage();
          },
        }}
      >
        {children}
      </ChatsLayout>
    </ChatRoomsContext.Provider>
  );
}
