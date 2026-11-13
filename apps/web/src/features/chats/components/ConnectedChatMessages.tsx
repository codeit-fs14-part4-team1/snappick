'use client';

import Button from '@/components/ui/Button';
import type { ChatRoomSummary, ChatViewerRole } from '../types';
import { getChatGreeting, getPartnerName } from '../utils';
import useChatMessages from '../useChatMessages';
import useReadChatMessages from '../useReadChatMessages';
import ChatMessageList from './ChatMessageList';
import ChatMessageComposer from './ChatMessageComposer';
import useSendChatMessage from '../useSendChatMessage';
import { useConnectedChatRooms } from './ConnectedChatsLayout';
import styles from './ChatsLayout.module.css';

export default function ConnectedChatMessages({
  room,
  viewerRole,
  now,
}: {
  room: ChatRoomSummary;
  viewerRole: ChatViewerRole;
  now: string;
}) {
  const query = useChatMessages(room.id);
  const markVisibleMessageRead = useReadChatMessages(room.id);
  const { sendMessage, isSending, sentMessageId } = useSendChatMessage(room.id);
  const { isRealtimeConnected } = useConnectedChatRooms();
  if (query.isPending)
    return (
      <div className={styles.empty} role="status">
        <p>메시지를 불러오고 있어요.</p>
      </div>
    );
  if (query.isError && query.messages.length === 0) {
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
        onVisibleMessage={markVisibleMessageRead}
        scrollToMessageId={sentMessageId}
        messages={query.messages}
        partnerName={getPartnerName(room.partner)}
        partnerImageUrl={room.partner.profileImageUrl}
        now={now}
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
        isSending={isSending}
        onSend={sendMessage}
      />
    </>
  );
}
