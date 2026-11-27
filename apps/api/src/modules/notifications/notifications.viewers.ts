import type { Server } from 'socket.io';

// server.ts에서 등록한다. 결제 정리 작업처럼 요청 밖에서 실행되는 코드도 같은 서버를 쓴다
let socketServer: Server | null = null;

export function setChatViewerSource(io: Server) {
  socketServer = io;
}

/**
 * 채팅방 화면을 보고 있는 계정 ID (NT-13)
 * 보고 있는 사람은 채팅에 바로 메시지가 보이므로 알림을 만들지 않는다
 * 소켓 서버가 없거나(스크립트 실행 등) 조회에 실패하면 모두 보지 않는 것으로 보고 알림을 만든다
 */
export async function getChatViewerIds(
  chatRoomId: string | null | undefined,
): Promise<Set<string>> {
  if (!socketServer || !chatRoomId) {
    return new Set();
  }

  try {
    const sockets = await socketServer
      .in(`viewing:${chatRoomId}`)
      .fetchSockets();
    return new Set(
      sockets.map((socket) => socket.data.auth.accountId as string),
    );
  } catch (error) {
    console.error(`[chat-viewers] ${chatRoomId} lookup failed`, error);
    return new Set();
  }
}
