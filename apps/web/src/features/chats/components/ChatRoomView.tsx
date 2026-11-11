import Link from 'next/link';
import type { ReactNode } from 'react';
import ChatAvatar from './ChatAvatar';
import type { ChatRoomSummary, ChatViewerRole } from '../types';
import { getPartnerName } from '../utils';
import styles from './ChatRoomView.module.css';

export default function ChatRoomView({
  room,
  viewerRole,
  children,
}: {
  room: ChatRoomSummary;
  viewerRole: ChatViewerRole;
  children: ReactNode;
}) {
  const profile = (
    <>
      <ChatAvatar
        src={room.partner.profileImageUrl}
        nickname={room.partner.nickname}
        size={32}
      />
      <span className={styles.profileName}>{getPartnerName(room.partner)}</span>
    </>
  );
  return (
    <section className={styles.room} aria-label="채팅방">
      <header className={styles.header}>
        <h2 id="chat-room-title" tabIndex={-1}>
          {viewerRole === 'user' && !room.partner.isWithdrawn ? (
            <Link
              href={`/photographers/${encodeURIComponent(room.partner.id)}`}
              className={styles.profile}
              aria-label={`${getPartnerName(room.partner)} 프로필`}
            >
              {profile}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m9 5 7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.chevron}
                />
              </svg>
            </Link>
          ) : (
            <span className={styles.profile}>{profile}</span>
          )}
        </h2>
        <Link
          href="/chats"
          className={styles.close}
          aria-label="채팅방 목록으로 돌아가기"
          scroll={false}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m5 5 14 14M19 5 5 19"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      </header>
      {children}
    </section>
  );
}
