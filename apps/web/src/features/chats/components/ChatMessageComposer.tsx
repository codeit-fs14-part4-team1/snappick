'use client';

import { useRef, useState } from 'react';
import type { ChatViewerRole } from '../types';
import styles from './ChatRoomView.module.css';

export default function ChatMessageComposer({
  viewerRole,
  isWithdrawn,
  isSending,
  onSend,
}: {
  viewerRole: ChatViewerRole;
  isWithdrawn: boolean;
  isSending: boolean;
  onSend: (content: string) => Promise<unknown>;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const disabled = isSending || isWithdrawn;
  const content = text.trim();
  const tooLong = content.length > 1000;

  async function submit() {
    if (sendingRef.current || disabled || !content || tooLong) return;
    sendingRef.current = true;
    try {
      await onSend(content);
      setText('');
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      // 안내는 데이터 연결부에서 제공하고, 사용자가 재시도할 수 있도록 입력을 보존합니다.
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <form
      className={styles.composer}
      aria-label="메시지 입력"
      aria-busy={isSending}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {viewerRole === 'photographer' && (
        <button
          type="button"
          className={styles.attach}
          aria-label="추가 메뉴"
          disabled
        >
          +
        </button>
      )}
      <textarea
        ref={inputRef}
        rows={1}
        aria-label="메시지"
        placeholder={
          isWithdrawn
            ? '상대방에게 메시지를 보낼 수 없어요'
            : '메시지를 입력하세요'
        }
        disabled={disabled}
        value={text}
        maxLength={1000}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== 229
          ) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <button
        type="submit"
        className={styles.send}
        aria-label="메시지 보내기"
        disabled={disabled || !content || tooLong}
      >
        <svg
          width="17"
          height="15"
          viewBox="0 0 17 15"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1.10156 7.09961H14.1016M9.10156 1.09961L15.1016 7.09961L9.10156 13.0996"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
