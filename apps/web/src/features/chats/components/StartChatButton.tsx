'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import { useGuestLoginModal } from '@/components/ui/GuestLoginProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { createChat } from '../api';

export default function StartChatButton({
  photographerId,
}: {
  photographerId: string;
}) {
  const { user, authStatus, fetchWithAuth } = useAuth();
  const { openGuestLoginModal } = useGuestLoginModal();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function handleClick() {
    if (requestRef.current || authStatus === 'initializing') return;
    if (authStatus === 'unauthenticated') {
      openGuestLoginModal();
      return;
    }
    if (authStatus !== 'authenticated' || !user) {
      showToast(
        '로그인 정보를 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.',
        'error',
      );
      return;
    }
    if (user.accountType !== 'USER') {
      showToast('일반 사용자만 문의를 시작할 수 있어요.', 'error');
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    try {
      const { chatRoomId } = await createChat(
        photographerId,
        fetchWithAuth,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
      router.push(`/chats/${encodeURIComponent(chatRoomId)}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : '';
      const notice =
        message === 'API 요청 실패: 400'
          ? '아직 문의를 받을 수 없는 작가이거나 잘못된 요청이에요.'
          : message === 'API 요청 실패: 401'
            ? '로그인이 만료됐어요. 다시 로그인해 주세요.'
            : message === 'API 요청 실패: 403'
              ? '문의를 시작할 권한이 없어요.'
              : message === 'API 요청 실패: 404'
                ? '작가 또는 회원 정보를 찾을 수 없어요.'
                : '문의를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';
      showToast(notice, 'error');
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }

  return (
    <Button
      variant="accent"
      size="lg"
      fullWidth
      disabled={pending || authStatus === 'initializing'}
      aria-busy={pending}
      onClick={handleClick}
    >
      {pending ? '문의 연결 중…' : '문의하기'}
    </Button>
  );
}
