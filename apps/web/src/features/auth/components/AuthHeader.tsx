'use client';

import Header, { type HeaderUser } from '@/components/layout/Header';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { io } from 'socket.io-client';

// 인증 상태를 기존 Header에 전달함
export default function AuthHeader() {
  const { user, authStatus, accessToken, fetchWithAuth } = useAuth();

  // 로그인 사용자 정보를 Header에서 사용하는 형식으로 변환함
  const headerUser: HeaderUser | null =
    authStatus === 'authenticated' && user
      ? {
          id: user.id,
          nickname: user.nickname,
          accountType: user.accountType,
          profileImageUrl: user.profileImageUrl,
        }
      : null;

  // 로그인한 경우에만 미읽음 알림을 조회
  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.hasUnread(),
    enabled: headerUser !== null,
    queryFn: async ({ signal }) => {
      const result = await fetchWithAuth<{ hasUnread: boolean }>(
        '/me/notifications/has-unread',
        { signal },
      );

      if (!result) throw new Error('미읽음 알림 여부를 확인하지 못했어요.');
      return result;
    },
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!url || !accessToken || authStatus !== 'authenticated') return;

    const socket = io(url, {
      auth: { token: accessToken },
      autoConnect: false,
    });

    function refreshUnread() {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.hasUnread(),
      });
    }

    socket.on('notification:new', refreshUnread);
    socket.on('connect', refreshUnread);

    const retryDelays = [1000, 2000, 4000];
    let retryIndex = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let checkingAuth = false;
    let active = true;

    async function recoverAuthentication() {
      if (!active || checkingAuth || retryTimer !== undefined) return;
      checkingAuth = true;

      try {
        await fetchWithAuth('/users/me', { cache: 'no-store' });
        retryIndex = 0;
      } catch (error) {
        const isTransient =
          error instanceof TypeError ||
          (error instanceof Error &&
            /^API 요청 실패: 5\d{2}$/.test(error.message));

        const delay = retryDelays[retryIndex];
        if (!active || !isTransient || delay === undefined) return;

        retryIndex += 1;
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          void recoverAuthentication();
        }, delay);
      } finally {
        checkingAuth = false;
      }
    }

    socket.on('auth:expired', recoverAuthentication);
    function handleConnectError(error: Error) {
      if (error.message === 'UNAUTHORIZED') {
        void recoverAuthentication();
      }
    }
    socket.on('connect_error', handleConnectError);
    socket.connect();

    return () => {
      active = false;
      clearTimeout(retryTimer);
      socket.off('notification:new', refreshUnread);
      socket.off('connect', refreshUnread);
      socket.off('auth:expired', recoverAuthentication);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [accessToken, authStatus, fetchWithAuth, queryClient]);

  return (
    <Header
      user={headerUser}
      hasUnreadNotifications={unreadQuery.data?.hasUnread ?? false}
    />
  );
}
