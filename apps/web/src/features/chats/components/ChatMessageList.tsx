'use client';

import { Fragment, useEffect, type ReactNode } from 'react';
import Button from '@/components/ui/Button';
import ScrollToEdgeButton from '@/components/ui/ScrollToEdgeButton';
import ChatAvatar from './ChatAvatar';
import InquiryCard from './InquiryCard';
import QuoteMessageCard from './QuoteMessageCard';
import ReservationEventCard from './ReservationEventCard';
import type { Quote } from '../quote';
import type { ChatMessageItem, ChatViewerRole } from '../types';
import { useChatScroll } from '../useChatScroll';
import { formatChatDate, formatChatTime } from '../utils';
import styles from './ChatMessageList.module.css';

type Props = {
  messages: ChatMessageItem[];
  viewerRole: ChatViewerRole;
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
  endContent?: ReactNode;
  startAtTop?: boolean;
  onEditQuote?: (quote: Quote) => void;
  onPayQuote?: (quote: Quote) => void;
};

export default function ChatMessageList({
  onEditQuote,
  onPayQuote,
  messages,
  viewerRole,
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
  endContent,
  startAtTop = false,
}: Props) {
  const {
    scrollRef,
    sentinelRef,
    newMessage,
    loadPrevious,
    beginBottomScroll,
    scrollToBottom,
  } = useChatScroll({
    messages,
    hasPrevious,
    isFetchingPrevious,
    isFetching,
    isPreviousError,
    onLoadPrevious,
    scrollToMessageId,
    startAtTop,
  });

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
  }, [messages, onVisibleMessage, scrollRef]);

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
        {messages.length === 0 && !greeting && !endContent ? (
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
              const confirmedQuote =
                system &&
                message.quote?.reservationId &&
                message.payload &&
                typeof message.payload === 'object' &&
                'type' in message.payload &&
                message.payload.type === 'RESERVATION_CONFIRMED'
                  ? message.quote
                  : null;
              const reservation = confirmedQuote?.reservationId
                ? {
                    event: 'RESERVATION_CONFIRMED' as const,
                    id: confirmedQuote.reservationId,
                    quoteName: confirmedQuote.quoteName,
                    shootAt: confirmedQuote.shootAt,
                    location: confirmedQuote.location,
                    amount: confirmedQuote.price,
                  }
                : system
                  ? message.reservation
                  : null;
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
                    className={
                      system && !reservation ? styles.system : styles.message
                    }
                    data-mine={
                      reservation
                        ? viewerRole ===
                          (reservation.event === 'RESERVATION_CONFIRMED' ||
                          reservation.event === 'RESERVATION_CANCEL_REQUESTED'
                            ? 'user'
                            : 'photographer')
                        : message.isMine
                    }
                    data-message-id={message.id}
                  >
                    <span className={styles.srOnly}>
                      {system ? '시스템' : message.isMine ? '나' : partnerName}:
                    </span>
                    <div
                      className={
                        reservation
                          ? styles.quoteContainer
                          : system
                            ? styles.systemContent
                            : message.messageType === 'INITIAL_REQUEST'
                              ? styles.requestContainer
                              : message.messageType === 'QUOTE' && message.quote
                                ? styles.quoteContainer
                                : styles.bubble
                      }
                    >
                      {reservation ? (
                        <ReservationEventCard
                          reservation={reservation}
                          now={now}
                        />
                      ) : message.messageType === 'INITIAL_REQUEST' ? (
                        <InquiryCard
                          payload={message.payload}
                          isMine={message.isMine}
                        />
                      ) : message.messageType === 'QUOTE' && message.quote ? (
                        <QuoteMessageCard
                          quote={message.quote}
                          createdAt={message.createdAt}
                          now={now}
                          received={!message.isMine}
                          onPay={
                            !message.isMine && onPayQuote
                              ? () => onPayQuote(message.quote!)
                              : undefined
                          }
                          onEdit={
                            message.isMine && onEditQuote
                              ? () => onEditQuote(message.quote!)
                              : undefined
                          }
                          superseded={
                            !message.quote.isLatest ||
                            messages.some(
                              (candidate) =>
                                candidate.quote?.shootingCaseId ===
                                  message.quote!.shootingCaseId &&
                                candidate.quote.version >
                                  message.quote!.version,
                            )
                          }
                        />
                      ) : (
                        message.content
                      )}
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
                        {message.messageType !== 'QUOTE' && (
                          <time
                            className={styles.time}
                            dateTime={message.createdAt}
                          >
                            {formatChatTime(message.createdAt)}
                          </time>
                        )}
                      </div>
                    )}
                  </li>
                </Fragment>
              );
            })}
            {endContent && <li>{endContent}</li>}
          </ol>
        )}
      </section>
      {newMessage ? (
        <button
          type="button"
          className={styles.newMessage}
          aria-label={
            newMessage.messageType === 'SYSTEM'
              ? `새 메시지: ${newMessage.content}. 최하단으로 이동`
              : `${partnerName}의 새 메시지: ${newMessage.content}. 최하단으로 이동`
          }
          onClick={scrollToBottom}
        >
          {newMessage.messageType !== 'SYSTEM' && (
            <>
              <ChatAvatar
                src={partnerImageUrl}
                nickname={partnerName}
                size={22}
              />
              <strong className={styles.newMessageName}>{partnerName}</strong>
            </>
          )}
          <span
            className={
              newMessage.messageType === 'SYSTEM'
                ? styles.newSystemMessageContent
                : styles.newMessageContent
            }
            role="status"
          >
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
