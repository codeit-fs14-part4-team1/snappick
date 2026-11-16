'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Button from '@/components/ui/Button';
import ScrollToEdgeButton from '@/components/ui/ScrollToEdgeButton';
import ChatAvatar from './ChatAvatar';
import type { ChatMessageItem } from '../types';
import { formatChatDate, formatChatTime } from '../utils';
import styles from './ChatMessageList.module.css';

type Props = {
  messages: ChatMessageItem[];
  partnerName: string;
  partnerImageUrl?: string | null;
  now: string;
  greeting?: string;
  hasPrevious: boolean;
  isFetchingPrevious: boolean;
  isFetching?: boolean;
  isPreviousError: boolean;
  onLoadPrevious: () => void;
  scrollToMessageId?: string;
  onVisibleMessage?: (message: ChatMessageItem) => void;
};

type ScrollAnchor = { id: string; offset: number };

function getScrollAnchor(element: HTMLElement): ScrollAnchor | null {
  const viewport = element.getBoundingClientRect();
  const message = Array.from(
    element.querySelectorAll<HTMLElement>('[data-message-id]'),
  ).find((item) => {
    const rect = item.getBoundingClientRect();
    return rect.bottom > viewport.top && rect.top < viewport.bottom;
  });
  return message?.dataset.messageId
    ? {
        id: message.dataset.messageId,
        offset: message.getBoundingClientRect().top - viewport.top,
      }
    : null;
}

function restoreScrollAnchor(
  element: HTMLElement,
  anchor: ScrollAnchor | null,
) {
  if (!anchor) return;
  const message = Array.from(
    element.querySelectorAll<HTMLElement>('[data-message-id]'),
  ).find((item) => item.dataset.messageId === anchor.id);
  if (message) {
    const delta =
      message.getBoundingClientRect().top -
      element.getBoundingClientRect().top -
      anchor.offset;
    if (Math.abs(delta) > 0.5) element.scrollTop += delta;
  }
}

export default function ChatMessageList({
  messages,
  partnerName,
  partnerImageUrl = null,
  now,
  greeting,
  hasPrevious,
  isFetchingPrevious,
  isFetching = false,
  isPreviousError,
  onLoadPrevious,
  scrollToMessageId,
  onVisibleMessage,
}: Props) {
  const scrollRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadPendingRef = useRef(false);
  const prependRef = useRef<ScrollAnchor | null>(null);
  const readingAnchorRef = useRef<ScrollAnchor | null>(null);
  const revealedMessageRef = useRef<string | undefined>(undefined);
  const followBottomRef = useRef(true);
  const latestMessageRef = useRef(messages.at(-1));
  const noticeFrameRef = useRef<number | null>(null);
  const [newMessage, setNewMessage] = useState<ChatMessageItem | null>(null);
  const beginBottomScroll = useCallback(() => {
    followBottomRef.current = true;
    prependRef.current = null;
    setNewMessage(null);
  }, []);

  useLayoutEffect(() => {
    const previous = latestMessageRef.current;
    const latest = messages.at(-1);
    latestMessageRef.current = latest;
    if (!previous || !latest || latest.id === previous.id) return;
    // 이전 내역 추가나 읽음 상태 갱신을 새 메시지로 취급하지 않습니다.
    const incoming = [...messages]
      .reverse()
      .find(
        (message) =>
          !message.isMine &&
          message.messageType !== 'SYSTEM' &&
          (Date.parse(message.createdAt) > Date.parse(previous.createdAt) ||
            (Date.parse(message.createdAt) === Date.parse(previous.createdAt) &&
              message.id > previous.id)),
      );
    if (!incoming || followBottomRef.current) return;
    if (noticeFrameRef.current !== null)
      cancelAnimationFrame(noticeFrameRef.current);
    noticeFrameRef.current = requestAnimationFrame(() => {
      noticeFrameRef.current = null;
      if (!followBottomRef.current) setNewMessage(incoming);
    });
  }, [messages]);
  useEffect(
    () => () => {
      if (noticeFrameRef.current !== null)
        cancelAnimationFrame(noticeFrameRef.current);
    },
    [],
  );
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !onVisibleMessage) return;
    const visible = new Set<string>();
    function reportVisible() {
      if (document.visibilityState !== 'visible' || !document.hasFocus())
        return;
      const target = [...messages]
        .reverse()
        .find(
          (message) =>
            !message.isMine &&
            !message.readAt &&
            message.recipientAccountId &&
            visible.has(message.id),
        );
      if (target) onVisibleMessage?.(target);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.messageId;
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        reportVisible();
      },
      { root },
    );
    root
      .querySelectorAll('[data-message-id]')
      .forEach((element) => observer.observe(element));
    window.addEventListener('focus', reportVisible);
    document.addEventListener('visibilitychange', reportVisible);
    return () => {
      observer.disconnect();
      window.removeEventListener('focus', reportVisible);
      document.removeEventListener('visibilitychange', reportVisible);
    };
  }, [messages, onVisibleMessage]);
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
    prependRef.current = getScrollAnchor(element);
    onLoadPrevious();
  }, [hasPrevious, isFetching, isFetchingPrevious, onLoadPrevious]);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    const previous = prependRef.current;
    if (!element || isFetchingPrevious) return;
    prependRef.current = null;
    restoreScrollAnchor(
      element,
      previous ?? (followBottomRef.current ? null : readingAnchorRef.current),
    );
    readingAnchorRef.current = getScrollAnchor(element);
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
    followBottomRef.current = true;
    element.scrollTop = element.scrollHeight;
  }, [messages, scrollToMessageId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    followBottomRef.current =
      element.scrollHeight - element.clientHeight - element.scrollTop < 2;
    const handleScroll = () => {
      followBottomRef.current =
        element.scrollHeight - element.clientHeight - element.scrollTop < 2;
      if (followBottomRef.current) setNewMessage(null);
      readingAnchorRef.current = getScrollAnchor(element);
      if (prependRef.current) prependRef.current = readingAnchorRef.current;
    };
    const observer = new ResizeObserver(() => {
      if (prependRef.current) return;
      if (followBottomRef.current) element.scrollTop = element.scrollHeight;
      else restoreScrollAnchor(element, readingAnchorRef.current);
    });
    element.addEventListener('scroll', handleScroll);
    observer.observe(element);
    let observedList: HTMLOListElement | null = null;
    const observeList = () => {
      const list = element.querySelector('ol');
      if (list === observedList) return;
      if (observedList) observer.unobserve(observedList);
      observedList = list;
      if (list) observer.observe(list);
    };
    // 빈 방에서 첫 메시지를 받으면 목록이 나중에 생성됩니다.
    const mutationObserver = new MutationObserver(observeList);
    mutationObserver.observe(element, { childList: true });
    observeList();
    return () => {
      element.removeEventListener('scroll', handleScroll);
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  return (
    <div className={styles.messageArea}>
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
                      <div className={styles.messageMeta}>
                        {message.isMine && !message.readAt && (
                          <span
                            className={styles.unread}
                            aria-label="상대방이 아직 읽지 않음"
                          >
                            안읽음
                          </span>
                        )}
                        <time
                          className={styles.time}
                          dateTime={message.createdAt}
                        >
                          {formatChatTime(message.createdAt)}
                        </time>
                      </div>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
      </section>
      {newMessage ? (
        <button
          type="button"
          className={styles.newMessage}
          aria-label={`${partnerName}의 새 메시지: ${newMessage.content}. 최하단으로 이동`}
          onClick={() => {
            const element = scrollRef.current;
            if (!element) return;
            beginBottomScroll();
            element.scrollTo({
              top: element.scrollHeight,
              behavior: 'instant',
            });
            element.focus({ preventScroll: true });
          }}
        >
          <ChatAvatar src={partnerImageUrl} nickname={partnerName} size={22} />
          <strong className={styles.newMessageName}>{partnerName}</strong>
          <span className={styles.newMessageContent} role="status">
            {newMessage.content}
          </span>
        </button>
      ) : (
        <ScrollToEdgeButton
          direction="bottom"
          targetRef={scrollRef}
          onScrollStart={beginBottomScroll}
          className={styles.scrollButton}
        />
      )}
    </div>
  );
}
