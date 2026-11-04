'use client';

import Link from 'next/link';
import { useConnectedChatRooms } from './ConnectedChatsLayout';
import { getPartnerName } from '../utils';
import styles from './ChatsLayout.module.css';

export default function ConnectedChatRoom({ roomId }: { roomId: string }) {
  const { rooms, isLoading, isError } = useConnectedChatRooms();
  const room = rooms.find((item) => item.id === roomId);
  if (!room)
    return (
      <section className={styles.empty}>
        <h2>
          {isLoading
            ? '문의 정보를 불러오고 있어요'
            : isError
              ? '문의 정보를 불러오지 못했어요'
              : '현재 목록에서 문의를 찾을 수 없어요'}
        </h2>
        <Link className={styles.exploreLink} href="/chats">
          문의 목록으로
        </Link>
      </section>
    );

  return (
    <section className={styles.empty} aria-label="선택한 문의 안내">
      <h2 id="chat-room-title" tabIndex={-1}>
        {getPartnerName(room.partner)}
      </h2>
      <p>대화 내역은 상세·메시지 API 연결 후 표시됩니다.</p>
      <Link className={styles.exploreLink} href="/chats" scroll={false}>
        문의 목록으로
      </Link>
    </section>
  );
}
