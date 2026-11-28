import { formatLongDate, formatTime, isSameDate } from '@/utils/dateTime';
import type {
  ChatRoomListPage,
  ChatRoomSummary,
  ChatMessagesPage,
  ChatMessageItem,
  ChatReservationEvent,
  ChatViewerRole,
} from './types';

const reservationEventTitles = {
  RESERVATION_CONFIRMED: '예약이 확정됐어요',
  RESERVATION_CANCELED: '예약이 취소됐어요',
  RESERVATION_CANCEL_REQUESTED: '예약 취소를 요청했어요',
  RESERVATION_CANCEL_REJECTED: '예약 취소 요청이 반려됐어요',
} as const;

// The room list returns stored system text without reservation event metadata.
const reservationEventsByContent = new Map<string, ChatReservationEvent>([
  ['작가가 예약을 취소했습니다.', 'RESERVATION_CANCELED'],
  ['작가가 예약 취소 요청을 수락했습니다.', 'RESERVATION_CANCELED'],
  ['사용자가 예약 취소를 요청했습니다.', 'RESERVATION_CANCEL_REQUESTED'],
  ['작가가 예약 취소 요청을 반려했습니다.', 'RESERVATION_CANCEL_REJECTED'],
  ['결과물이 전달됐어요', 'RESERVATION_DELIVERED'],
]);

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

export function getInquiryMessageTitle(isMine: boolean) {
  return isMine ? '촬영 문의를 보냈어요' : '촬영 문의가 도착했어요';
}

export function getReservationEventTitle(
  event: ChatReservationEvent,
  role: ChatViewerRole,
) {
  if (event !== 'RESERVATION_DELIVERED') return reservationEventTitles[event];
  return role === 'photographer'
    ? '결과물을 전달했어요'
    : '결과물이 도착했어요';
}

export function getChatMessageText(
  message: Pick<ChatMessageItem, 'messageType' | 'content'> &
    Partial<Pick<ChatMessageItem, 'reservation'>>,
  role: ChatViewerRole,
) {
  if (message.messageType === 'INITIAL_REQUEST') {
    return getInquiryMessageTitle(role === 'user');
  }
  if (message.messageType === 'SYSTEM') {
    const event =
      message.reservation?.event ??
      reservationEventsByContent.get(message.content);
    if (event) return getReservationEventTitle(event, role);
  }
  return message.content;
}

export function getMessagePreview(room: ChatRoomSummary, role: ChatViewerRole) {
  if (room.lastMessage) return getChatMessageText(room.lastMessage, role);
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
