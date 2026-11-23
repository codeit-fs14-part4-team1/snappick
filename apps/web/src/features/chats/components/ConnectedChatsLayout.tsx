'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
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
  const { user } = useAuth();
  if (!user) return null;
  return (
    <AuthenticatedChatsLayout user={user}>{children}</AuthenticatedChatsLayout>
  );
}

function AuthenticatedChatsLayout({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  const { authStatus, fetchWithAuth } = useAuth();
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

  const loadPage = useCallback<ChatRoomListLoader>(
    (params) => getChatRooms(params, fetchWithAuth),
    [fetchWithAuth],
  );
  const query = useChatRooms({
    accountId: authStatus === 'authenticated' ? user.id : null,
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
