'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ChatMessageItem } from './types';

type Options = {
  messages: ChatMessageItem[];
  hasPrevious: boolean;
  isFetchingPrevious: boolean;
  isFetching: boolean;
  isPreviousError: boolean;
  onLoadPrevious: () => void;
  scrollToMessageId?: string;
  startAtTop: boolean;
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

/** Manages chat scroll anchors, bottom following, and incoming message previews. */
export function useChatScroll({
  messages,
  hasPrevious,
  isFetchingPrevious,
  isFetching,
  isPreviousError,
  onLoadPrevious,
  scrollToMessageId,
  startAtTop,
}: Options) {
  const initialStartAtTop = useRef(startAtTop);
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
    if (element)
      element.scrollTop = initialStartAtTop.current ? 0 : element.scrollHeight;
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

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    beginBottomScroll();
    element.scrollTo({ top: element.scrollHeight, behavior: 'instant' });
    element.focus({ preventScroll: true });
  }, [beginBottomScroll]);

  return {
    scrollRef,
    sentinelRef,
    newMessage,
    loadPrevious,
    beginBottomScroll,
    scrollToBottom,
  };
}
