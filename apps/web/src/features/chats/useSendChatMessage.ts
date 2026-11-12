'use client';

import { useState } from 'react';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';
import { queryKeys } from '@/lib/queryKeys';
import { sendChatMessage } from './api';
import type { ChatMessagesPage } from './types';

export default function useSendChatMessage(chatRoomId: string) {
  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [sentMessageId, setSentMessageId] = useState<string>();
  const messagesKey = queryKeys.chats.messages(chatRoomId);

  const mutation = useMutation({
    mutationFn: (content: string) =>
      sendChatMessage(chatRoomId, content, fetchWithAuth),
    // 전송 요청은 서버에서 중복 저장될 수 있으므로 자동 재시도하지 않습니다.
    retry: false,
    onSuccess: async (message) => {
      // 전송 이전에 시작한 조회가 저장된 메시지를 덮어쓰지 않도록 취소합니다.
      await queryClient.cancelQueries({ queryKey: messagesKey, exact: true });
      queryClient.setQueryData<InfiniteData<ChatMessagesPage>>(
        messagesKey,
        (old) => {
          if (
            !old ||
            old.pages.some((page) =>
              page.items.some((item) => item.id === message.id),
            )
          )
            return old;
          return {
            ...old,
            pages: old.pages.map((page, index) =>
              index === 0 ? { ...page, items: [...page.items, message] } : page,
            ),
          };
        },
      );
      setSentMessageId(message.id);
      // 소켓 연결 전에도 최신 대화와 목록의 마지막 메시지·정렬을 서버 값으로 맞춥니다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
    },
    onError: (error) => {
      const notice =
        error.message === 'API 요청 실패: 401'
          ? '로그인이 만료됐어요. 다시 로그인해 주세요.'
          : error.message === 'API 요청 실패: 403'
            ? '이 문의에 메시지를 보낼 권한이 없어요.'
            : error.message === 'API 요청 실패: 404'
              ? '존재하지 않는 문의예요.'
              : error.message === 'API 요청 실패: 422'
                ? '상대방에게 메시지를 보낼 수 없어요.'
                : error.message === 'API 요청 실패: 400'
                  ? '메시지 내용을 확인해 주세요. 1,000자까지 보낼 수 있어요.'
                  : '메시지를 보내지 못했어요. 다시 시도해 주세요.';
      showToast(notice, 'error');
    },
  });
  return {
    sendMessage: mutation.mutateAsync,
    isSending: mutation.isPending,
    sentMessageId,
  };
}
