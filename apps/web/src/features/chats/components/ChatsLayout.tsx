'use client';

import { useEffect, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import ChatRoomList from '@/features/chats/components/ChatRoomList';
import styles from './ChatsLayout.module.css';

type ChatsLayoutProps = {
  accountId: string | null;
  selectedRoomId: string | null;
  listProps: Omit<
    ComponentProps<typeof ChatRoomList>,
    'className' | 'selectedRoomId'
  >;
  children: ReactNode;
};

export default function ChatsLayout({
  accountId,
  selectedRoomId,
  listProps,
  children,
}: ChatsLayoutProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previousRoomId = useRef<string | null>(null);
  const previousAccountId = useRef(accountId);
  const isEmpty =
    Boolean(accountId) &&
    !selectedRoomId &&
    !listProps.isLoading &&
    !listProps.isError &&
    listProps.rooms.length === 0;
  useEffect(() => {
    if (previousAccountId.current !== accountId) {
      previousRoomId.current = null;
      previousAccountId.current = accountId;
    }
    const frame = requestAnimationFrame(() => {
      if (selectedRoomId) {
        workspaceRef.current
          ?.querySelector<HTMLElement>('#chat-room-title')
          ?.focus({ preventScroll: true });
      } else if (previousRoomId.current) {
        workspaceRef.current
          ?.querySelector<HTMLAnchorElement>(
            `[data-room-id="${CSS.escape(previousRoomId.current)}"]`,
          )
          ?.focus({ preventScroll: true });
      }
      previousRoomId.current = selectedRoomId;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedRoomId, listProps.isLoading, accountId]);

  return (
    <>
      <div
        ref={workspaceRef}
        className={styles.workspace}
        data-room-open={selectedRoomId !== null}
        data-empty={isEmpty}
      >
        <ChatRoomList
          {...listProps}
          className={styles.sidebar}
          selectedRoomId={selectedRoomId ?? undefined}
          hideEmptyState={isEmpty}
        />
        <div className={styles.conversation}>
          {isEmpty ? (
            <section className={styles.empty} aria-label="문의 내역 없음">
              {listProps.role === 'photographer' ? (
                <>
                  <h2>아직 받은 문의가 없어요</h2>
                  <p>새로운 촬영 문의가 도착하면 알려드릴게요.</p>
                </>
              ) : (
                <>
                  <h2>아직 문의한 작가가 없어요</h2>
                  <p>작가 프로필에서 [문의하기]를 누르면 대화가 시작돼요</p>
                  <Link href="/" className={styles.exploreLink}>
                    작가 찾아보기
                  </Link>
                </>
              )}
            </section>
          ) : (
            children
          )}
        </div>
      </div>
    </>
  );
}
