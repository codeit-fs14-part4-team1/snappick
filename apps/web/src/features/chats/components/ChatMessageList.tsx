'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import Button from '@/components/ui/Button';
import type { ChatMessageItem } from '../types';
import { formatChatDate, formatChatTime } from '../utils';
import styles from './ChatMessageList.module.css';

type Props = {
  messages: ChatMessageItem[];
  partnerName: string;
  now: string;
  greeting?: string;
  hasPrevious: boolean;
  isFetchingPrevious: boolean;
  isFetching?: boolean;
  isPreviousError: boolean;
  onLoadPrevious: () => void;
  scrollToMessageId?: string;
};

export default function ChatMessageList({
  messages,
  partnerName,
  now,
  greeting,
  hasPrevious,
  isFetchingPrevious,
  isFetching = false,
  isPreviousError,
  onLoadPrevious,
  scrollToMessageId,
}: Props) {
  const scrollRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadPendingRef = useRef(false);
  const prependRef = useRef<{ height: number; top: number } | null>(null);
  const revealedMessageRef = useRef<string | undefined>(undefined);
  const loadPrevious = useCallback(() => {
    const element = scrollRef.current;
    if (
      !element ||
      !hasPrevious ||
      isFetching ||
      isFetchingPrevious ||
      loadPendingRef.current
    )
      return;
    loadPendingRef.current = true;
    prependRef.current = {
      height: element.scrollHeight,
      top: element.scrollTop,
    };
    onLoadPrevious();
  }, [hasPrevious, isFetching, isFetchingPrevious, onLoadPrevious]);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    const previous = prependRef.current;
    if (!element || !previous || isFetchingPrevious) return;
    element.scrollTop = previous.top + element.scrollHeight - previous.height;
    prependRef.current = null;
    loadPendingRef.current = false;
  }, [messages, isFetchingPrevious]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (
      !sentinel ||
      !root ||
      !hasPrevious ||
      isFetching ||
      isFetchingPrevious ||
      isPreviousError
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadPrevious();
      },
      { root, rootMargin: '80px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    hasPrevious,
    isFetching,
    isFetchingPrevious,
    isPreviousError,
    loadPrevious,
  ]);

  useLayoutEffect(() => {
    if (
      !scrollToMessageId ||
      revealedMessageRef.current === scrollToMessageId ||
      !messages.some((message) => message.id === scrollToMessageId)
    )
      return;
    const element = scrollRef.current;
    if (!element) return;
    prependRef.current = null;
    revealedMessageRef.current = scrollToMessageId;
    element.scrollTop = element.scrollHeight;
  }, [messages, scrollToMessageId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    let followBottom =
      element.scrollHeight - element.clientHeight - element.scrollTop < 2;
    const handleScroll = () => {
      followBottom =
        element.scrollHeight - element.clientHeight - element.scrollTop < 2;
    };
    const observer = new ResizeObserver(() => {
      if (followBottom && !prependRef.current)
        element.scrollTop = element.scrollHeight;
    });
    element.addEventListener('scroll', handleScroll);
    observer.observe(element);
    const list = element.querySelector('ol');
    if (list) observer.observe(list);
    return () => {
      element.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={scrollRef}
      className={styles.scroll}
      aria-label="대화 내용"
      tabIndex={0}
    >
      {(hasPrevious || isPreviousError) && (
        <div ref={sentinelRef} className={styles.previous}>
          {isPreviousError && (
            <>
              <p role="alert">이전 메시지를 불러오지 못했어요.</p>
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching || isFetchingPrevious}
                onClick={loadPrevious}
              >
                다시 시도
              </Button>
            </>
          )}
          <span
            role="status"
            className={isFetchingPrevious ? undefined : styles.srOnly}
          >
            {isFetchingPrevious
              ? '이전 메시지를 불러오는 중…'
              : '위로 스크롤하면 이전 메시지를 불러옵니다.'}
          </span>
        </div>
      )}
      {messages.length === 0 && !greeting ? (
        <p className={styles.empty}>아직 대화 내역이 없습니다.</p>
      ) : (
        <ol className={styles.list}>
          {greeting && (
            <li className={styles.message} aria-label="작가 자동 인사말">
              <span className={styles.srOnly}>작가 자동 안내:</span>
              <div className={styles.bubble}>{greeting}</div>
            </li>
          )}
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDay =
              !previous ||
              formatChatDate(previous.createdAt) !==
                formatChatDate(message.createdAt);
            const system = message.messageType === 'SYSTEM';
            return (
              <Fragment key={message.id}>
                {showDay && (
                  <li className={styles.day}>
                    <time dateTime={message.createdAt}>
                      {formatChatDate(message.createdAt, now)}
                    </time>
                  </li>
                )}
                <li
                  className={system ? styles.system : styles.message}
                  data-mine={message.isMine}
                  data-message-id={message.id}
                >
                  <span className={styles.srOnly}>
                    {system ? '시스템' : message.isMine ? '나' : partnerName}:
                  </span>
                  <div
                    className={system ? styles.systemContent : styles.bubble}
                  >
                    {message.content}
                  </div>
                  {!system && (
                    <time className={styles.time} dateTime={message.createdAt}>
                      {formatChatTime(message.createdAt)}
                    </time>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}
    </section>
  );
}
