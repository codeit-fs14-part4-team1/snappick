'use client';

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { getChatMessages } from './api';
import { mergeChatMessagePages } from './utils';

const MESSAGE_LIMIT = 30;

export default function useChatMessages(chatRoomId: string) {
  const { user, authStatus, fetchWithAuth } = useAuth();
  const query = useInfiniteQuery({
    queryKey: queryKeys.chats.messages(chatRoomId, MESSAGE_LIMIT),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getChatMessages(
        chatRoomId,
        { cursor: pageParam, limit: MESSAGE_LIMIT, signal },
        fetchWithAuth,
      ),
    getNextPageParam: (page) =>
      page.hasNext && page.nextCursor ? page.nextCursor : undefined,
    enabled: authStatus === 'authenticated' && Boolean(user && chatRoomId),
    retry: false,
  });
  const messages = useMemo(
    () => mergeChatMessagePages(query.data?.pages ?? [], user?.id ?? ''),
    [query.data, user?.id],
  );
  return { ...query, messages };
}
