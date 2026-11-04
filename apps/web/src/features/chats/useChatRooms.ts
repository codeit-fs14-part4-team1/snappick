'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { mergeChatRoomPages } from './utils';
import type { ChatRoomListLoader } from './types';

type UseChatRoomsOptions = {
  accountId: string | null;
  loadPage: ChatRoomListLoader;
  limit?: number;
};

// TODO: 백엔드에서 hasNext와 nextCursor를 제공하면 다음 페이지 조회 동작 검증
export default function useChatRooms({
  accountId,
  loadPage,
  limit = 20,
}: UseChatRoomsOptions) {
  const roomsKey = queryKeys.chats.rooms(limit);
  const query = useInfiniteQuery({
    queryKey: roomsKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      loadPage({ cursor: pageParam, limit, signal }),
    getNextPageParam: (page) =>
      page.hasNext && page.nextCursor ? page.nextCursor : undefined,
    enabled: Boolean(accountId),
    retry: false,
  });

  return {
    ...query,
    rooms: mergeChatRoomPages(query.data?.pages ?? []),
  };
}
