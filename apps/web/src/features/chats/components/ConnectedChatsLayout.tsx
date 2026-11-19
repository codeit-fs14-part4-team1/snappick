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
import AuthGuard from '@/features/auth/components/AuthGuard';
import type { AuthUser } from '@/features/auth/types';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getChatRooms } from '../api';
import useChatRooms from '../useChatRooms';
import useChatSocket from '../useChatSocket';
import type { ChatRoomListLoader, ChatRoomSummary } from '../types';
import ChatsLayout from './ChatsLayout';

type ChatRoomsContextValue = {
  rooms: ChatRoomSummary[];
  now: string;
  isLoading: boolean;
  isError: boolean;
  isRealtimeConnected: boolean;
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
  return (
    <AuthGuard loginDescription="로그인 후 문의 내역을 확인할 수 있어요.">
      {(user) => (
        <AuthenticatedChatsLayout user={user}>
          {children}
        </AuthenticatedChatsLayout>
      )}
    </AuthGuard>
  );
}

function AuthenticatedChatsLayout({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  const { authStatus, accessToken, clearAuth } = useAuth();
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
  const realtime = useChatSocket(
    query.rooms.map((room) => room.id),
    selectedRoomId,
  );

  const role = user.accountType === 'PHOTOGRAPHER' ? 'photographer' : 'user';
  return (
    <ChatRoomsContext.Provider
      value={{
        rooms: query.rooms,
        now: now.toISOString(),
        isLoading: query.isPending,
        isError: query.isError,
        isRealtimeConnected: realtime.status === 'connected',
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
          isError:
            query.isError &&
            (query.rooms.length === 0 || realtime.status === 'connected'),
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
