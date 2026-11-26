'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';
import { queryKeys } from '@/lib/queryKeys';
import { formatDate, formatTime, isSameDate } from '@/utils/dateTime';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import styles from './NotificationMenu.module.css';

type NotificationItem = {
  notificationId: string;
  targetType: 'CHAT_ROOM' | 'RESERVATION' | 'PHOTOGRAPHER_PROFILE';
  targetId: string;
  message: string;
  read: boolean;
  seen: boolean;
  createdAt: string;
  scheduledAt?: string | null;
};

type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
};

const PAGE_SIZE = 20;
const SEEN_BATCH_SIZE = 100;

function notificationHref({ targetType, targetId }: NotificationItem) {
  const id = encodeURIComponent(targetId);
  switch (targetType) {
    case 'CHAT_ROOM':
      return `/chats/${id}`;
    case 'RESERVATION':
      return `/my/reservations/${id}`;
    case 'PHOTOGRAPHER_PROFILE':
      return `/photographers/${id}#reviews`;
  }
}

function formatNotificationTime(timestamp: string, now: number) {
  if (isSameDate(timestamp, now)) {
    return now - Date.parse(timestamp) < 3_600_000
      ? formatRelativeTime(timestamp, now)
      : formatTime(timestamp);
  }
  return isSameDate(timestamp, now - 86_400_000)
    ? '어제'
    : formatDate(timestamp);
}

type NotificationMenuProps = {
  hasUnseenNotifications: boolean;
};

export default function NotificationMenu({
  hasUnseenNotifications,
}: NotificationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const notifications = useInfiniteQuery({
    queryKey: queryKeys.notifications.infinite(PAGE_SIZE),
    enabled: isOpen,
    staleTime: 0,
    initialPageParam: null as string | null,
    getNextPageParam: (page: NotificationPage) => page.nextCursor,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      const page = await fetchWithAuth<NotificationPage>(
        `/me/notifications?${params}`,
        { signal },
      );
      if (!page) throw new Error('알림을 불러오지 못했어요.');
      return page;
    },
  });
  const readNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await fetchWithAuth<{ read: boolean }>(
        `/me/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: 'PATCH' },
      );
      if (!result?.read) throw new Error('알림을 읽음 처리하지 못했어요.');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
  });
  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];
  const markSeen = useMutation({
    mutationFn: async (ids: string[]) => {
      for (let offset = 0; offset < ids.length; offset += SEEN_BATCH_SIZE) {
        const result = await fetchWithAuth<{ updatedCount: number }>(
          '/me/notifications/seen',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notificationIds: ids.slice(offset, offset + SEEN_BATCH_SIZE),
            }),
          },
        );
        if (!result) throw new Error('알림 확인 상태를 저장하지 못했어요.');
      }
    },
    onError: () => showToast('알림 확인 상태를 저장하지 못했어요.', 'error'),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
  });

  function closeMenu() {
    setIsOpen(false);
    const ids = items
      .filter((item) => !item.read && !item.seen)
      .map((item) => item.notificationId);
    if (ids.length > 0) markSeen.mutate(ids);
  }

  const dismissMenu = useEffectEvent(closeMenu);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (!menuRef.current?.contains(target)) {
        dismissMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      dismissMenu();
      buttonRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className={styles.notification}>
      <button
        type="button"
        ref={buttonRef}
        aria-label={hasUnseenNotifications ? '알림 (새 알림 있음)' : '알림'}
        aria-expanded={isOpen}
        aria-controls="notification-menu"
        className={styles.notificationButton}
        onClick={() => {
          if (isOpen) closeMenu();
          else setIsOpen(true);
        }}
      >
        <Image src="/bell.svg" alt="" width={24} height={24} />
        {hasUnseenNotifications && (
          <span aria-hidden="true" className={styles.unreadDot} />
        )}
      </button>

      {isOpen && (
        <div
          id="notification-menu"
          aria-labelledby="notification-menu-title"
          className={styles.notificationMenu}
        >
          <p id="notification-menu-title" className={styles.menuTitle}>
            알림
          </p>

          <div className={styles.menuBody}>
            {notifications.isPending && (
              <p role="status" className={styles.emptyMessage}>
                알림을 불러오는 중이에요
              </p>
            )}
            {notifications.isError && !notifications.data && (
              <div className={styles.feedback}>
                <p role="alert">알림을 불러오지 못했어요.</p>
                <button
                  type="button"
                  onClick={() => void notifications.refetch()}
                >
                  다시 시도
                </button>
              </div>
            )}
            {notifications.isSuccess && items.length === 0 && (
              <p className={styles.emptyMessage}>새 알림이 없어요</p>
            )}
            {items.length > 0 && (
              <ul className={styles.notificationList}>
                {items.map((item) => {
                  const href = notificationHref(item);
                  const timestamp = item.scheduledAt ?? item.createdAt;
                  return (
                    <li key={item.notificationId}>
                      <Link
                        href={href}
                        className={styles.notificationItem}
                        data-unread={!item.read}
                        data-unseen={!item.read && !item.seen}
                        aria-label={
                          item.read ? undefined : `읽지 않음. ${item.message}`
                        }
                        onNavigate={(event) => {
                          if (readNotification.isPending) {
                            event.preventDefault();
                            return;
                          }
                          if (item.read) {
                            closeMenu();
                            return;
                          }
                          event.preventDefault();
                          readNotification.mutate(item.notificationId, {
                            onSuccess: () => {
                              closeMenu();
                              router.push(href);
                            },
                          });
                        }}
                      >
                        <span>{item.message}</span>
                        <time dateTime={timestamp}>
                          {formatNotificationTime(
                            timestamp,
                            notifications.dataUpdatedAt,
                          )}
                        </time>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {readNotification.isError && (
              <p role="alert" className={styles.feedback}>
                읽음 처리에 실패했어요. 알림을 다시 선택해 주세요.
              </p>
            )}
            {notifications.hasNextPage && (
              <div className={styles.feedback}>
                <button
                  type="button"
                  disabled={notifications.isFetching}
                  onClick={() => void notifications.fetchNextPage()}
                >
                  {notifications.isFetchingNextPage
                    ? '불러오는 중…'
                    : notifications.isFetchNextPageError
                      ? '이전 알림 다시 불러오기'
                      : '이전 알림 더 보기'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
