'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import type { ChatRoomSummary, ChatViewerRole } from '../types';
import { getChatGreeting, getPartnerName } from '../utils';
import useChatMessages from '../useChatMessages';
import useReadChatMessages from '../useReadChatMessages';
import ChatMessageList from './ChatMessageList';
import ChatMessageComposer from './ChatMessageComposer';
import InquiryForm, { InquiryPrompt } from './InquiryForm';
import useSendChatMessage from '../useSendChatMessage';
import useSendQuote from '../useSendQuote';
import type { Quote } from '../quote';
import QuoteActionMenu from './QuoteActionMenu';
import ConnectedQuoteComposer from './ConnectedQuoteComposer';
import { useConnectedChatRooms } from './ConnectedChatsLayout';
import styles from './ChatsLayout.module.css';

type Props = {
  room: ChatRoomSummary;
  viewerRole: ChatViewerRole;
  now: string;
};

export default function ConnectedChatMessages({
  room,
  viewerRole,
  now,
}: Props) {
  const query = useChatMessages(room.id);
  const { isRealtimeConnected } = useConnectedChatRooms();
  if (query.isPending)
    return (
      <div className={styles.empty} role="status">
        <p>메시지를 불러오고 있어요.</p>
      </div>
    );
  if (query.isError && !query.data) {
    const message = query.error instanceof Error ? query.error.message : '';
    const notice =
      message === 'API 요청 실패: 403'
        ? '이 문의에 접근할 권한이 없어요.'
        : message === 'API 요청 실패: 404'
          ? '존재하지 않는 문의예요.'
          : '메시지를 불러오지 못했어요.';
    return (
      <div className={styles.empty} role="alert">
        <p>{notice}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }
  return (
    <ChatMessagesContent
      room={room}
      viewerRole={viewerRole}
      now={now}
      query={query}
      isRealtimeConnected={isRealtimeConnected}
    />
  );
}

function ChatMessagesContent({
  room,
  viewerRole,
  now,
  query,
  isRealtimeConnected,
}: Props & {
  query: ReturnType<typeof useChatMessages>;
  isRealtimeConnected: boolean;
}) {
  const router = useRouter();
  const markVisibleMessageRead = useReadChatMessages(room.id);
  const quoteMutation = useSendQuote(room.id, room.partner.id);
  const [quoteSelection, setQuoteSelection] = useState<'new' | Quote | null>(
    null,
  );
  const [scrollQuoteId, setScrollQuoteId] = useState<string>();
  const quoteMessageId = query.messages.find(
    (message) => message.quote?.id === scrollQuoteId,
  )?.id;
  const { sendMessage, sendInquiry, isSending, sentMessageId } =
    useSendChatMessage(room.id);
  // 첫 조회 후 초기 상태를 정하고, 작가의 답장이 와도 작성 중인 폼은 유지합니다.
  const [step, setStep] = useState<'form' | 'skipped' | 'done'>(() =>
    viewerRole === 'user' && !query.hasNextPage && query.messages.length === 0
      ? 'form'
      : 'done',
  );
  const formPanel = useRef<HTMLDivElement>(null);
  const canOfferInquiry =
    viewerRole === 'user' &&
    !room.partner.isWithdrawn &&
    step !== 'done' &&
    !query.messages.some(
      (message) => message.isMine && message.messageType !== 'SYSTEM',
    );
  const showInquiryForm = canOfferInquiry && step === 'form';
  return (
    <>
      {isRealtimeConnected &&
        query.isRefetchError &&
        !query.isFetchNextPageError && (
          <div className={styles.connectionNotice} role="alert">
            <span>대화를 갱신하지 못했어요.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
            >
              다시 시도
            </Button>
          </div>
        )}
      <ChatMessageList
        startAtTop={showInquiryForm}
        onVisibleMessage={markVisibleMessageRead}
        scrollToMessageId={scrollQuoteId ? quoteMessageId : sentMessageId}
        onEditQuote={
          viewerRole === 'photographer' && !room.partner.isWithdrawn
            ? setQuoteSelection
            : undefined
        }
        onPayQuote={
          viewerRole === 'user' && !room.partner.isWithdrawn
            ? (quote) =>
                router.push(
                  `/payments?${new URLSearchParams({ quoteId: quote.id })}`,
                )
            : undefined
        }
        messages={query.messages}
        partnerName={getPartnerName(room.partner)}
        partnerImageUrl={room.partner.profileImageUrl}
        now={now}
        endContent={
          canOfferInquiry ? (
            <div>
              <div ref={formPanel} hidden={!showInquiryForm}>
                <InquiryForm
                  referenceDate={now}
                  onSkip={() => setStep('skipped')}
                  onSubmit={async (payload) => {
                    try {
                      await sendInquiry(payload);
                      setStep('done');
                    } catch (error) {
                      if (
                        error instanceof Error &&
                        error.message === 'API 요청 실패: 409'
                      ) {
                        setStep('done');
                        return;
                      }
                      throw error;
                    }
                  }}
                />
              </div>
              {step === 'skipped' && (
                <InquiryPrompt
                  disabled={isSending}
                  onResume={() => {
                    setStep('form');
                    requestAnimationFrame(() =>
                      formPanel.current?.querySelector('button')?.focus(),
                    );
                  }}
                />
              )}
            </div>
          ) : undefined
        }
        greeting={
          viewerRole === 'user' &&
          !room.partner.isWithdrawn &&
          !query.hasNextPage
            ? getChatGreeting(room.partner.nickname)
            : undefined
        }
        hasPrevious={query.hasNextPage}
        isFetchingPrevious={query.isFetchingNextPage}
        isFetching={query.isFetching}
        isPreviousError={query.isFetchNextPageError}
        onLoadPrevious={() => {
          if (query.hasNextPage && !query.isFetching)
            void query.fetchNextPage();
        }}
      />
      <ChatMessageComposer
        viewerRole={viewerRole}
        isWithdrawn={room.partner.isWithdrawn}
        isSending={isSending || quoteMutation.isSending}
        isBlocked={showInquiryForm}
        onSend={async (content) => {
          await sendMessage(content);
          setScrollQuoteId(undefined);
        }}
        quoteAction={
          viewerRole === 'photographer' && !room.partner.isWithdrawn ? (
            <QuoteActionMenu
              disabled={isSending || quoteMutation.isSending}
              onSelect={() => setQuoteSelection('new')}
            />
          ) : undefined
        }
      />
      {viewerRole === 'photographer' && quoteSelection && (
        <ConnectedQuoteComposer
          initialQuote={quoteSelection === 'new' ? undefined : quoteSelection}
          superseded={
            quoteSelection !== 'new' &&
            query.messages.some(
              (message) =>
                message.quote?.shootingCaseId ===
                  quoteSelection.shootingCaseId &&
                (message.quote.version > quoteSelection.version ||
                  (message.quote.id === quoteSelection.id &&
                    !message.quote.isLatest)),
            )
          }
          onClose={() => setQuoteSelection(null)}
          onSubmit={async (draft) => {
            const quote = await quoteMutation.sendQuote({
              draft,
              shootingCaseId:
                quoteSelection === 'new'
                  ? undefined
                  : quoteSelection.shootingCaseId,
              expectedVersion:
                quoteSelection === 'new' ? undefined : quoteSelection.version,
            });
            setScrollQuoteId(quote.id);
          }}
        />
      )}
    </>
  );
}
