'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';
import { queryKeys } from '@/lib/queryKeys';
import { markChatMessagesRead } from './api';
import type { ChatMessageItem, ChatMessagesPage } from './types';

export default function useReadChatMessages(roomId: string) {
  const { user, fetchWithAuth } = useAuth();
  const client = useQueryClient();
  const { showToast } = useToast();
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<ChatMessageItem | null>(null);
  const completed = useRef<ChatMessageItem | null>(null);
  const failureShown = useRef(false);

  useEffect(
    () => () => {
      controller.current?.abort();
      pending.current = null;
    },
    [],
  );

  return useCallback(
    (message: ChatMessageItem) => {
      if (!user || message.recipientAccountId !== user.id || message.readAt)
        return;
      const newer = (a: ChatMessageItem, b: ChatMessageItem) =>
        Date.parse(a.createdAt) > Date.parse(b.createdAt) ||
        (a.createdAt === b.createdAt && a.id > b.id);
      if (completed.current && !newer(message, completed.current)) return;
      if (!pending.current || newer(message, pending.current))
        pending.current = message;
      if (controller.current) return;
      const request = new AbortController();
      controller.current = request;
      void (async () => {
        try {
          while (pending.current && !request.signal.aborted) {
            if (
              document.visibilityState !== 'visible' ||
              !document.hasFocus()
            ) {
              pending.current = null;
              break;
            }
            const target = pending.current;
            pending.current = null;
            const result = await markChatMessagesRead(
              roomId,
              target.id,
              fetchWithAuth,
              request.signal,
            );
            if (request.signal.aborted) return;
            completed.current = target;
            failureShown.current = false;
            client.setQueryData<InfiniteData<ChatMessagesPage>>(
              queryKeys.chats.messages(roomId),
              (old) =>
                old && {
                  ...old,
                  pages: old.pages.map((page) => ({
                    ...page,
                    items: page.items.map((item) =>
                      item.recipientAccountId === user.id &&
                      !item.readAt &&
                      (Date.parse(item.createdAt) <
                        Date.parse(target.createdAt) ||
                        (item.createdAt === target.createdAt &&
                          item.id <= target.id))
                        ? { ...item, readAt: result.readAt }
                        : item,
                    ),
                  })),
                },
            );
            void client.invalidateQueries({
              queryKey: queryKeys.chats.rooms().slice(0, -1),
            });
            if (pending.current && !newer(pending.current, target))
              pending.current = null;
          }
        } catch {
          pending.current = null;
          if (!request.signal.aborted && !failureShown.current) {
            failureShown.current = true;
            showToast(
              '읽음 상태를 저장하지 못했어요. 대화로 돌아오면 다시 시도합니다.',
              'error',
            );
          }
        } finally {
          if (controller.current === request) controller.current = null;
        }
      })();
    },
    [user, fetchWithAuth, client, roomId, showToast],
  );
}
