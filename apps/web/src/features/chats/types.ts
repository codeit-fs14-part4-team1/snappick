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
