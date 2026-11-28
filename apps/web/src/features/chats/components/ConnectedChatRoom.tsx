'use client';

import Link from 'next/link';
import { useConnectedChatRooms } from './ConnectedChatsLayout';
import { useAuth } from '@/features/auth/context/AuthContext';
import ChatRoomView from './ChatRoomView';
import ConnectedChatMessages from './ConnectedChatMessages';
import styles from './ChatsLayout.module.css';

export default function ConnectedChatRoom({ roomId }: { roomId: string }) {
  const { rooms, isLoading, isError, now } = useConnectedChatRooms();
  const { user } = useAuth();
  const room = rooms.find((item) => item.id === roomId);
  if (!room && (isLoading || isError))
    return (
      <section className={styles.empty}>
        <h2>
          {isLoading
            ? '문의 정보를 불러오고 있어요'
            : '문의 정보를 불러오지 못했어요'}
        </h2>
        <Link className={styles.exploreLink} href="/chats">
          문의 목록으로
        </Link>
      </section>
    );

  if (!room)
    return (
      <section className={styles.empty}>
        <h2>대화를 찾을 수 없어요</h2>
        {rooms.length > 0 && (
          <p className={styles.unavailableHint}>
            왼쪽 문의 목록에서 대화를 선택해 주세요.
          </p>
        )}
        <Link
          className={
            rooms.length > 0
              ? `${styles.exploreLink} ${styles.unavailableBackLink}`
              : styles.exploreLink
          }
          href="/chats"
        >
          문의 목록으로
        </Link>
      </section>
    );

  if (!user) return null;
  const role = user.accountType === 'PHOTOGRAPHER' ? 'photographer' : 'user';
  return (
    <ChatRoomView room={room} viewerRole={role}>
      <ConnectedChatMessages
        key={`${room.id}:${user.id}`}
        room={room}
        viewerRole={role}
        now={now}
      />
    </ChatRoomView>
  );
}
