import type { ChatRoomListPage, ChatRoomSummary } from './types';

export function getPartnerName(partner: ChatRoomSummary['partner']) {
  return partner.isWithdrawn ? '알 수 없는 사용자' : partner.nickname;
}

export function getMessagePreview(room: ChatRoomSummary) {
  if (room.lastMessage) return room.lastMessage.content;
  if (room.partner.isWithdrawn) return '아직 대화 내역이 없습니다.';
  return `안녕하세요, ${room.partner.nickname}입니다 :) 문의 주셔서 감사해요.
아래에 촬영 정보를 남겨주시면 더 정확하게 상담해 드릴게요!`;
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
