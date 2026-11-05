'use client';

import Link from 'next/link';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { useEffect, useRef } from 'react';
import type { ChatRoomSummary, ChatViewerRole } from '../types';
import { getMessagePreview, getPartnerName } from '../utils';
import ChatAvatar from './ChatAvatar';
import styles from './ChatRooms.module.css';

type ChatRoomListProps = {
  className?: string;
  rooms: ChatRoomSummary[];
  role: ChatViewerRole;
  now: Date;
  selectedRoomId?: string;
  getRoomHref: (roomId: string) => string;
  isLoading?: boolean;
  isError?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isFetchNextPageError?: boolean;
  hideEmptyState?: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
};

export default function ChatRoomList({
  className,
  rooms,
  role,
  now,
  selectedRoomId,
  getRoomHref,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  hideEmptyState = false,
  onRetry,
  onLoadMore,
}: ChatRoomListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage || isFetchNextPageError)
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { root: scrollRef.current, rootMargin: '80px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, onLoadMore]);

  const title = role === 'photographer' ? '받은 문의' : '문의 내역';

  return (
    <section
      className={[styles.listPanel, className].filter(Boolean).join(' ')}
      aria-label={title}
    >
      <h1 className={styles.listTitle}>{title}</h1>
      <div
        ref={scrollRef}
        className={styles.listScroll}
        tabIndex={0}
        aria-label={`${title} 목록`}
      >
        {isLoading ? (
          <div role="status" aria-label="문의 목록을 불러오는 중">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className={styles.skeletonRow}
                aria-hidden="true"
              >
                <span className={styles.avatar} />
                <span className={styles.skeletonText} />
              </div>
            ))}
          </div>
        ) : isError && rooms.length === 0 ? (
          <div className={styles.state} role="alert">
            <strong>문의를 불러오지 못했어요</strong>
            <p>잠시 후 다시 시도해 주세요.</p>
            <button type="button" className={styles.retry} onClick={onRetry}>
              다시 시도
            </button>
          </div>
        ) : rooms.length === 0 ? (
          hideEmptyState ? null : (
            <div className={styles.state} role="status">
              <strong>
                {role === 'photographer'
                  ? '아직 받은 문의가 없어요'
                  : '아직 문의 내역이 없어요'}
              </strong>
              <p>
                {role === 'photographer'
                  ? '새로운 촬영 문의가 도착하면 알려드릴게요.'
                  : '마음에 드는 작가에게 촬영을 문의해 보세요.'}
              </p>
            </div>
          )
        ) : (
          <>
            {isError && !isFetchNextPageError && (
              <div className={styles.updateError} role="alert">
                목록을 갱신하지 못했어요.
                <button
                  type="button"
                  className={styles.retry}
                  onClick={onRetry}
                >
                  다시 시도
                </button>
              </div>
            )}
            <ul className={styles.list}>
              {rooms.map((room) => (
                <li key={room.id}>
                  <Link
                    data-room-id={room.id}
                    href={getRoomHref(room.id)}
                    scroll={false}
                    className={styles.room}
                    aria-current={
                      room.id === selectedRoomId ? 'page' : undefined
                    }
                  >
                    <ChatAvatar src={room.partner.profileImageUrl} />
                    <span className={styles.roomContent}>
                      <span className={styles.roomTop}>
                        <strong className={styles.name}>
                          {getPartnerName(room.partner)}
                        </strong>
                        <time
                          dateTime={room.lastMessageAt}
                          className={styles.time}
                        >
                          {formatRelativeTime(room.lastMessageAt, now)}
                        </time>
                      </span>
                      <span className={styles.roomBottom}>
                        <span className={styles.preview}>
                          {getMessagePreview(room)}
                        </span>
                        {room.unreadCount > 0 && (
                          <span
                            className={styles.unread}
                            aria-label={`안 읽은 메시지 ${room.unreadCount}개`}
                          >
                            {room.unreadCount > 99 ? '99+' : room.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {hasNextPage && (
              <div ref={sentinelRef} className={styles.more}>
                {isFetchNextPageError && (
                  <p role="alert">다음 문의를 불러오지 못했어요.</p>
                )}
                <button
                  type="button"
                  className={styles.retry}
                  onClick={onLoadMore}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage
                    ? '불러오는 중…'
                    : isFetchNextPageError
                      ? '다시 시도'
                      : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
