'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/ToastProvider';

type Status = 'connecting' | 'connected' | 'error';

export default function useChatSocket(
  roomIds: string[],
  chatRoomId: string | null,
) {
  const { accessToken, user, authStatus, fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const noticeShown = useRef(false);
  const [status, setStatus] = useState<Status>('connecting');
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  const accountId = user?.id;
  const subscriptionKey = JSON.stringify([...new Set(roomIds)].sort());

  useEffect(() => {
    if (!url || !accessToken || !accountId || authStatus !== 'authenticated')
      return;

    // 알려진 문의방을 함께 구독합니다. 구독 목록이 바뀌면 기존 연결을
    // 정리하므로 서버에 별도 퇴장 이벤트가 없어도 이전 방에 남지 않습니다.
    const socket = io(url, {
      auth: { token: accessToken },
      autoConnect: false,
    });
    let active = true;
    let checkingAuth = false;
    const joinTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const joinRetries = new Map<string, number>();
    const rejectedRooms = new Set<string>();
    const exhaustedRooms = new Set<string>();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    let needsMessageRefresh = false;
    const subscribedRooms = new Set<string>(JSON.parse(subscriptionKey));
    const pendingRooms = new Set(subscribedRooms);

    function notifyFailure() {
      if (!active || noticeShown.current) return;
      noticeShown.current = true;
      showToast(
        '실시간 연결이 불안정해요. 계속되면 새로고침해 주세요.',
        'error',
      );
    }
    function waitForReconnect() {
      if (noticeTimer) return;
      noticeTimer = setTimeout(notifyFailure, 5000);
    }
    function markConnected() {
      clearTimeout(noticeTimer);
      noticeTimer = undefined;
      noticeShown.current = false;
      setStatus('connected');
    }

    function clearRoomTimers(id: string) {
      clearTimeout(joinTimers.get(id));
      clearTimeout(retryTimers.get(id));
      joinTimers.delete(id);
      retryTimers.delete(id);
    }

    function clearJoinTimers() {
      for (const id of subscribedRooms) clearRoomTimers(id);
    }

    function updateJoinStatus() {
      if (rejectedRooms.size > 0 || exhaustedRooms.size > 0) {
        setStatus('error');
      } else if (pendingRooms.size === 0) {
        markConnected();
      } else {
        setStatus('connecting');
      }
    }

    function joinRoom(id: string) {
      if (!active || !socket.connected || !pendingRooms.has(id)) return;
      clearRoomTimers(id);
      joinTimers.set(
        id,
        setTimeout(() => retryJoin(id), 10_000),
      );
      socket.emit('chat:join', { chatRoomId: id });
    }

    function retryJoin(id: string) {
      if (!active || !socket.connected || !pendingRooms.has(id)) return;
      clearTimeout(joinTimers.get(id));
      joinTimers.delete(id);
      if (retryTimers.has(id)) return;
      const retries = joinRetries.get(id) ?? 0;
      if (retries >= 3) {
        // 늦은 성공 응답으로 복구할 수 있도록 pending 상태는 유지합니다.
        exhaustedRooms.add(id);
        updateJoinStatus();
        notifyFailure();
        return;
      }
      updateJoinStatus();
      waitForReconnect();
      joinRetries.set(id, retries + 1);
      retryTimers.set(
        id,
        setTimeout(
          () => {
            retryTimers.delete(id);
            joinRoom(id);
          },
          1000 * 2 ** retries,
        ),
      );
    }

    function refreshConversation(includeMessages = true) {
      // 같은 묶음에 현재 방과 다른 방 이벤트가 함께 와도 대화 갱신을 유지합니다.
      needsMessageRefresh ||= includeMessages;
      clearTimeout(refreshTimer);
      // 연속 수신은 한 번의 조회로 합칩니다. POST 응답과 소켓 수신도
      // 동일한 API 목록으로 합쳐지므로 메시지를 중복 추가하지 않습니다.
      refreshTimer = setTimeout(() => {
        const refreshMessages = needsMessageRefresh;
        needsMessageRefresh = false;
        void (async () => {
          if (refreshMessages && chatRoomId)
            await queryClient.cancelQueries({
              queryKey: queryKeys.chats.messages(chatRoomId),
              exact: true,
            });
          if (!active) return;
          // 페이지 크기와 관계없이 문의 목록만 갱신합니다.
          const updates = [
            queryClient.invalidateQueries({
              queryKey: queryKeys.chats.rooms().slice(0, -1),
            }),
          ];
          if (refreshMessages && chatRoomId)
            updates.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.chats.messages(chatRoomId),
                exact: true,
              }),
            );
          await Promise.all(updates);
        })();
      }, 50);
    }

    socket.on('connect', () => {
      if (!active) return;
      setStatus('connecting');
      clearJoinTimers();
      joinRetries.clear();
      rejectedRooms.clear();
      exhaustedRooms.clear();
      pendingRooms.clear();
      for (const id of subscribedRooms) {
        pendingRooms.add(id);
      }
      if (pendingRooms.size === 0) {
        markConnected();
        refreshConversation();
        return;
      }
      for (const id of pendingRooms) joinRoom(id);
    });
    socket.on('chat:joined', (payload: { chatRoomId?: string }) => {
      if (
        !active ||
        !payload?.chatRoomId ||
        !pendingRooms.has(payload.chatRoomId)
      )
        return;
      pendingRooms.delete(payload.chatRoomId);
      clearRoomTimers(payload.chatRoomId);
      exhaustedRooms.delete(payload.chatRoomId);
      updateJoinStatus();
      // 최초 입장과 재연결 모두 연결이 끊겨 있던 동안의 메시지를 보완합니다.
      refreshConversation(payload.chatRoomId === chatRoomId);
    });
    socket.on('message:new', (payload: { chatRoomId?: string }) => {
      if (
        active &&
        payload?.chatRoomId &&
        subscribedRooms.has(payload.chatRoomId)
      )
        refreshConversation(payload.chatRoomId === chatRoomId);
    });
    socket.on('disconnect', () => {
      clearJoinTimers();
      if (active) {
        setStatus('connecting');
        waitForReconnect();
      }
    });
    socket.on(
      'chat:error',
      (payload: { code?: string; chatRoomId?: string } | undefined) => {
        if (!active) return;
        const id = payload?.chatRoomId;
        // 방 ID가 없는 오류는 다른 방의 입장·재시도를 중단시키지 않습니다.
        if (!id || !pendingRooms.has(id)) {
          if (!id) notifyFailure();
          return;
        }
        if (payload?.code === 'INTERNAL_ERROR') {
          retryJoin(id);
          return;
        }
        // 권한·검증 오류는 재시도하지 않되 다른 방의 연결은 유지합니다.
        rejectedRooms.add(id);
        pendingRooms.delete(id);
        exhaustedRooms.delete(id);
        clearRoomTimers(id);
        updateJoinStatus();
        notifyFailure();
      },
    );
    socket.on('connect_error', (error: Error) => {
      if (!active) return;
      setStatus(socket.active ? 'connecting' : 'error');
      waitForReconnect();
      if (error.message !== 'UNAUTHORIZED' || checkingAuth) return;
      checkingAuth = true;
      // 기존 인증 함수가 만료된 HTTP 토큰을 갱신하면 accessToken 변경으로
      // 이 연결을 정리하고 새 토큰으로 다시 접속합니다.
      void fetchWithAuth('/users/me').catch(() => {
        if (active) setStatus('error');
      });
    });
    socket.connect();

    return () => {
      active = false;
      clearJoinTimers();
      clearTimeout(refreshTimer);
      clearTimeout(noticeTimer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [
    url,
    accessToken,
    accountId,
    authStatus,
    chatRoomId,
    subscriptionKey,
    queryClient,
    fetchWithAuth,
    showToast,
  ]);

  return {
    status: url ? status : 'error',
  };
}
