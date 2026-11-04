import type { GetChatRoomsParams, ChatRoomListPage } from './types';
import { authFetch } from '@/features/auth/authFetch';

type ChatAuth = Parameters<typeof authFetch>[2];

type ChatRoomsResponse = Pick<ChatRoomListPage, 'items'> &
  Partial<Pick<ChatRoomListPage, 'nextCursor' | 'hasNext'>>;

export async function getChatRooms(
  { cursor, limit = 20, signal }: GetChatRoomsParams,
  auth: ChatAuth,
): Promise<ChatRoomListPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const page = await authFetch<ChatRoomsResponse>(
    `/chats?${params}`,
    { signal },
    auth,
  );
  if (!page) throw new Error('채팅방 목록 응답이 없습니다.');
  // 페이지네이션은 후속 구현 예정이므로 items만 있는 현재 응답 지원
  return {
    items: page.items,
    nextCursor: page.nextCursor ?? null,
    hasNext: page.hasNext ?? false,
  };
}
