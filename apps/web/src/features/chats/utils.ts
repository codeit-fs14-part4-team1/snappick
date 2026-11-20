import { formatLongDate, formatTime, isSameDate } from '@/utils/dateTime';
import type {
  ChatRoomListPage,
  ChatRoomSummary,
  ChatMessagesPage,
  ChatMessageItem,
} from './types';

export function formatChatDate(value: string, now?: string) {
  if (now && isSameDate(value, now)) return '오늘';
  return formatLongDate(value);
}

export function formatChatTime(value: string) {
  return formatTime(value);
}

export function getChatGreeting(photographerName: string) {
  return `안녕하세요, ${photographerName}입니다 :) 문의 주셔서 감사해요.\n아래에 촬영 정보를 남겨주시면 더 정확하게 상담해 드릴게요!`;
}

export function mergeChatMessagePages(
  pages: ChatMessagesPage[],
  accountId: string,
): ChatMessageItem[] {
  const messages = new Map<string, ChatMessageItem>();
  for (const page of pages) {
    for (const message of page.items) {
      if (messages.has(message.id)) continue;
      messages.set(message.id, {
        ...message,
        // SYSTEM은 발신자가 없는 안내이며, 수신자가 null인 메시지도 내 발신으로 추정하지 않습니다.
        isMine:
          message.messageType !== 'SYSTEM' &&
          message.recipientAccountId !== null &&
          message.recipientAccountId !== accountId,
      });
    }
  }
  return [...messages.values()].sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function getPartnerName(partner: ChatRoomSummary['partner']) {
  return partner.isWithdrawn ? '알 수 없는 사용자' : partner.nickname;
}

export function getMessagePreview(room: ChatRoomSummary) {
  if (room.lastMessage) return room.lastMessage.content;
  if (room.partner.isWithdrawn) return '아직 대화 내역이 없습니다.';
  return getChatGreeting(room.partner.nickname);
}

export function mergeChatRoomPages(pages: ChatRoomListPage[]) {
  const rooms = new Map<string, ChatRoomSummary>();
  for (const page of pages) {
    for (const room of page.items) {
      const previous = rooms.get(room.id);
      if (
        !previous ||
        Date.parse(room.lastMessageAt) > Date.parse(previous.lastMessageAt)
      ) {
        rooms.set(room.id, room);
      }
    }
  }
  return [...rooms.values()].sort(
    (a, b) =>
      Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt) ||
      b.id.localeCompare(a.id),
  );
}
