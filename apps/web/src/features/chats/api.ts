import type {
  GetChatRoomsParams,
  ChatRoomListPage,
  CreateChatResponse,
  ChatMessagesPage,
  ChatMessage,
  SendChatMessageInput,
} from './types';
import type { FetchWithAuth } from '@/features/auth/types';
import type { CreateQuoteInput, Quote } from './quote';

export async function createQuote(
  input: CreateQuoteInput,
  fetchWithAuth: FetchWithAuth,
): Promise<Quote> {
  const quote = await fetchWithAuth<Quote>('/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (
    !quote?.id ||
    quote.chatRoomId !== input.chatRoomId ||
    !quote.shootingCaseId
  )
    throw new Error('견적 전송 응답이 올바르지 않습니다.');
  return quote;
}

export async function getQuote(
  quoteId: string,
  fetchWithAuth: FetchWithAuth,
  signal?: AbortSignal,
): Promise<Quote> {
  const quote = await fetchWithAuth<Quote>(
    `/quotes/${encodeURIComponent(quoteId)}`,
    { signal },
  );
  if (!quote || quote.id !== quoteId)
    throw new Error('견적 조회 응답이 올바르지 않습니다.');
  return quote;
}

export async function markChatMessagesRead(
  chatRoomId: string,
  lastReadMessageId: string,
  fetchWithAuth: FetchWithAuth,
  signal?: AbortSignal,
) {
  const result = await fetchWithAuth<{
    lastReadMessageId: string;
    updatedCount: number;
    readAt: string;
  }>(`/chats/${encodeURIComponent(chatRoomId)}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lastReadMessageId }),
    signal,
  });
  if (!result || result.lastReadMessageId !== lastReadMessageId)
    throw new Error('읽음 처리 응답이 올바르지 않습니다.');
  return result;
}

export async function sendChatMessage(
  chatRoomId: string,
  input: SendChatMessageInput,
  fetchWithAuth: FetchWithAuth,
): Promise<ChatMessage> {
  const message = await fetchWithAuth<ChatMessage>(
    `/chats/${encodeURIComponent(chatRoomId)}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        typeof input === 'string'
          ? { messageType: 'TEXT', content: input }
          : input,
      ),
    },
  );
  if (!message?.id || message.chatRoomId !== chatRoomId)
    throw new Error('메시지 전송 응답이 올바르지 않습니다.');
  return message;
}

export async function getChatMessages(
  chatRoomId: string,
  { cursor, limit = 30, signal }: GetChatRoomsParams,
  fetchWithAuth: FetchWithAuth,
): Promise<ChatMessagesPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const page = await fetchWithAuth<ChatMessagesPage>(
    `/chats/${encodeURIComponent(chatRoomId)}/messages?${params}`,
    { signal },
  );
  if (!page) throw new Error('메시지 조회 응답이 없습니다.');
  return page;
}

export async function createChat(
  photographerId: string,
  fetchWithAuth: FetchWithAuth,
  signal?: AbortSignal,
): Promise<CreateChatResponse> {
  const result = await fetchWithAuth<CreateChatResponse>('/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photographerId }),
    signal,
  });
  if (!result?.chatRoomId) throw new Error('채팅방 생성 응답이 없습니다.');
  return result;
}

type ChatRoomsResponse = Pick<ChatRoomListPage, 'items'> &
  Partial<Pick<ChatRoomListPage, 'nextCursor' | 'hasNext'>>;

export async function getChatRooms(
  { cursor, limit = 20, signal }: GetChatRoomsParams,
  fetchWithAuth: FetchWithAuth,
): Promise<ChatRoomListPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const page = await fetchWithAuth<ChatRoomsResponse>(`/chats?${params}`, {
    signal,
  });
  if (!page) throw new Error('채팅방 목록 응답이 없습니다.');
  // 페이지네이션은 후속 구현 예정이므로 items만 있는 현재 응답 지원
  return {
    items: page.items,
    nextCursor: page.nextCursor ?? null,
    hasNext: page.hasNext ?? false,
  };
}
