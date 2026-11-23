import type { Category, MessageType, Region, Style } from '@snappick/shared';
import type { Quote } from './quote';

/** POST /chats/:chatRoomId/messages의 INITIAL_REQUEST payload. 빈 필드는 생략합니다. */
export type InquiryPayload = {
  date?: string;
  timeSlot?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'UNDECIDED';
  region?: Region;
  location?: string;
  concept?: Style[];
  category?: Category;
};

export type SendChatMessageInput =
  string | { messageType: 'INITIAL_REQUEST'; payload: InquiryPayload };

/** GET /chats 응답 중 채팅방 목록 표시에 사용하는 필드 */
export type ChatRoomSummary = {
  id: string;
  partner:
    | {
        id: string;
        nickname: string;
        profileImageUrl: string | null;
        isWithdrawn: false;
      }
    | {
        id: null;
        nickname: null;
        profileImageUrl: null;
        isWithdrawn: true;
      };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string;
};

export type ChatRoomListPage = {
  items: ChatRoomSummary[];
  nextCursor: string | null;
  hasNext: boolean;
};

export type GetChatRoomsParams = {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
};

export type ChatRoomListLoader = (
  params: GetChatRoomsParams,
) => Promise<ChatRoomListPage>;

export type ChatViewerRole = 'user' | 'photographer';

/** GET /chats/{chatRoomId}/messages */
export type ChatMessage = {
  id: string;
  chatRoomId: string;
  recipientAccountId: string | null;
  messageType: MessageType;
  content: string;
  payload: unknown;
  quote: Quote | null;
  reservation: unknown;
  readAt: string | null;
  createdAt: string;
};

export type ChatMessagesPage = {
  items: ChatMessage[];
  nextCursor: string | null;
  hasNext: boolean;
};

export type ChatMessageItem = ChatMessage & { isMine: boolean };

/** POST /chats: 새 문의를 만들거나 이미 있는 문의 반환 */
export type CreateChatResponse = {
  chatRoomId: string;
  isNew: boolean;
  photographer: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
  };
  createdAt: string;
};
