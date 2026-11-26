'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getQuote, getChatRooms } from '@/features/chats/api';
import useChatRooms from '@/features/chats/useChatRooms';
import { toQuoteDraft } from '@/features/chats/quote';
import AccessDenied from '@/components/ui/AccessDenied';
import StateMessage from '@/components/ui/StateMessage';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { queryKeys } from '@/lib/queryKeys';
import { preparePayment, confirmPayment, type PaymentResult } from '../api';
import useTossPaymentWindow from '../useTossPaymentWindow';
import PaymentCompletion from './PaymentCompletion';
import PaymentPage from './PaymentPage';
import styles from './PaymentPage.module.css';

// 주소의 message는 조작될 수 있어 쓰지 않고, 알려진 코드만 문구로 바꿉니다.
const failReasons: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소했어요. 다시 결제할 수 있어요.',
  PAY_PROCESS_ABORTED:
    '결제 진행 중 문제가 생겼어요. 결제를 다시 시도해 주세요.',
  REJECT_CARD_COMPANY:
    '카드사에서 결제를 거절했어요. 다른 결제 수단으로 시도해 주세요.',
};

function isForbidden(error: unknown) {
  return error instanceof Error && 'status' in error && error.status === 403;
}

export default function PaymentFlow({
  mode = 'checkout',
}: {
  mode?: 'checkout' | 'success' | 'fail';
}) {
  const params = useSearchParams();
  const router = useRouter();
  const quoteId = params.get('quoteId') ?? '';
  const returnChatRoomId = params.get('chatRoomId') ?? '';
  const validReturnChatRoomId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      returnChatRoomId,
    )
      ? returnChatRoomId
      : null;
  const { user, fetchWithAuth } = useAuth();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [quoteSuperseded, setQuoteSuperseded] = useState(false);
  const [supersededDialogDismissed, setSupersededDialogDismissed] =
    useState(false);
  // 화면을 연 시각 기준. 여는 동안 지난 경우는 서버가 막습니다.
  const [openedAt] = useState(() => Date.now());
  const [quoteExpired, setQuoteExpired] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  // 서버가 결제 결과를 확인하는 동안 true
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const started = useRef(false);
  const busy = useRef(false);
  const { active, openPaymentWindow } = useTossPaymentWindow();
  const quoteQuery = useQuery({
    queryKey: queryKeys.quotes.detail(quoteId),
    queryFn: ({ signal }) => getQuote(quoteId, fetchWithAuth, signal),
    enabled: Boolean(quoteId && user?.accountType === 'USER'),
    staleTime: 0,
    // 권한 오류는 다시 요청해도 같으므로 재시도하지 않습니다.
    retry: (count, error) => !isForbidden(error) && count < 3,
    // 결제 결과가 확정되면 화면을 자동으로 갱신합니다.
    refetchInterval: (query) =>
      query.state.data?.paymentPending ? 3000 : false,
  });
  const chatRoomId = quoteQuery.data?.chatRoomId ?? validReturnChatRoomId;
  const chatHref = chatRoomId
    ? `/chats/${encodeURIComponent(chatRoomId)}`
    : '/chats';
  const failCode = mode === 'fail' ? (params.get('code') ?? '') : '';
  const retryMessage =
    (Object.hasOwn(failReasons, failCode) && failReasons[failCode]) ||
    '결제를 다시 시도해 주세요.';
  const checkoutHref = `/payments?${new URLSearchParams({ quoteId })}`;
  const showCallbackError =
    mode === 'fail' || (mode === 'success' && Boolean(error));
  const showCheckoutDetails =
    mode === 'checkout' || showCallbackError || quoteSuperseded;
  // 견적 응답에는 작가 정보가 없으므로 문의 목록에서 표시 정보를 찾습니다.
  const roomQuery = useChatRooms({
    accountId:
      showCheckoutDetails && user?.accountType === 'USER' ? user.id : null,
    loadPage: (options) => getChatRooms(options, fetchWithAuth),
  });
  const partner = roomQuery.rooms.find(
    (room) => room.id === quoteQuery.data?.chatRoomId,
  )?.partner;
  const {
    hasNextPage,
    isFetching,
    isError: roomsError,
    fetchNextPage,
  } = roomQuery;

  useEffect(() => {
    if (
      showCheckoutDetails &&
      quoteQuery.data &&
      !partner &&
      hasNextPage &&
      !isFetching &&
      !roomsError
    ) {
      void fetchNextPage();
    }
  }, [
    showCheckoutDetails,
    quoteQuery.data,
    partner,
    hasNextPage,
    isFetching,
    roomsError,
    fetchNextPage,
  ]);

  async function completePayment(approved: PaymentResult) {
    setResult(approved);
    await Promise.allSettled([
      client.invalidateQueries({ queryKey: queryKeys.quotes.all }),
      client.invalidateQueries({
        queryKey: queryKeys.chats.all,
        refetchType: 'all',
      }),
      client.invalidateQueries({ queryKey: queryKeys.reservations.all }),
    ]);
  }

  async function approve() {
    if (busy.current) return;
    const paymentKey = params.get('paymentKey');
    const orderId = params.get('orderId');
    const amountText = params.get('amount');
    const amount = Number(amountText);
    if (
      !paymentKey ||
      !orderId ||
      !amountText ||
      !Number.isSafeInteger(amount) ||
      amount < 0
    ) {
      setError('결제 결과 정보가 올바르지 않아요. 결제 내역을 확인해 주세요.');
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    setRestartRequired(false);
    setChecking(false);
    try {
      // 서버는 orderId의 소유자와 DB 금액을 다시 검증합니다.
      const approved = await confirmPayment(
        { paymentKey, orderId, amount },
        fetchWithAuth,
      );
      await completePayment(approved);
    } catch (cause) {
      if (isForbidden(cause)) {
        setAccessDenied(true);
        return;
      }
      void client.invalidateQueries({ queryKey: queryKeys.chats.all });
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'QUOTE_NOT_LATEST'
      ) {
        setQuoteSuperseded(true);
        void quoteQuery.refetch();
        return;
      }
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'QUOTE_EXPIRED'
      ) {
        setQuoteExpired(true);
        setError('촬영 일시가 지나 결제할 수 없어요.');
        return;
      }
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'PAYMENT_RETRY_REQUIRED'
      ) {
        setRestartRequired(true);
        setError('결제에 실패했어요');
        return;
      }
      const latest = await quoteQuery.refetch();
      if (!latest.isError && latest.data?.paymentPending) {
        setChecking(true);
        return;
      }
      // 이미 처리된 결제라면 결제 준비 단계에서 서버가 막습니다.
      setRestartRequired(true);
      setError('결제를 완료하지 못했어요');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  useEffect(() => {
    if (mode !== 'success' || started.current || user?.accountType !== 'USER')
      return;
    started.current = true;
    void approve();
    // 승인 요청은 콜백 진입 시 한 번만 시작합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user?.accountType]);

  useEffect(() => {
    if (!checking || pending || quoteQuery.data?.paymentPending !== false)
      return;
    // 서버가 처리를 마쳤으면 확정된 결과를 한 번 더 받아옵니다.
    const timer = setTimeout(() => void approve(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, pending, quoteQuery.data?.paymentPending]);

  async function pay() {
    if (busy.current || !user || !quoteQuery.data) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const payment = await preparePayment(quoteId, fetchWithAuth);
      if (!active.current) return;
      if (payment.status === 'SUCCEEDED') {
        await completePayment(payment);
        return;
      }
      const query = new URLSearchParams({
        quoteId,
        chatRoomId: quoteQuery.data.chatRoomId,
      });

      await openPaymentWindow(user.id, payment, query);
    } catch (cause) {
      if (!active.current) return;
      if (isForbidden(cause)) {
        setAccessDenied(true);
        return;
      }
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'QUOTE_NOT_LATEST'
      ) {
        setQuoteSuperseded(true);
        void quoteQuery.refetch();
        return;
      }
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'QUOTE_EXPIRED'
      ) {
        setQuoteExpired(true);
        setError('촬영 일시가 지나 결제할 수 없어요.');
        return;
      }
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'PAYMENT_IN_PROGRESS'
      ) {
        const latest = await quoteQuery.refetch();
        if (!latest.isError && latest.data?.paymentPending) return;
      }
      const message = cause instanceof Error ? cause.message : '';
      setError(
        message === 'API 요청 실패: 409'
          ? '견적 또는 결제 상태가 변경됐어요. 채팅에서 최신 견적과 예약 내역을 확인해 주세요.'
          : message.startsWith('토스 테스트')
            ? message
            : '결제를 진행하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
      void quoteQuery.refetch();
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }

  if (user?.accountType !== 'USER')
    return <StateMessage title="일반 사용자만 결제할 수 있어요" />;

  if (accessDenied || isForbidden(quoteQuery.error)) return <AccessDenied />;

  const quote = quoteQuery.data;
  if (mode === 'checkout' && result)
    return (
      <PaymentCompletion
        reservationId={result.reservationId}
        reservationNumber={result.reservationNumber}
        amount={quote?.price ?? 0}
        quote={quote}
        chatHref={chatHref}
      />
    );
  const callbackCanRestart = mode === 'fail' || restartRequired;
  const canShowReservedQuote =
    callbackCanRestart || (mode === 'checkout' && !quoteQuery.isError);
  if (canShowReservedQuote && quote?.reservationStatus) {
    return (
      <StateMessage
        className={styles.state}
        title={
          quote.reservationStatus === 'CANCELED'
            ? '취소된 예약의 견적이에요'
            : '이미 결제가 완료된 견적이에요'
        }
        link={
          quote.reservationId
            ? {
                label: '예약 상세 보기',
                href: `/my/reservations/${encodeURIComponent(quote.reservationId)}`,
              }
            : { label: '예약 내역 보기', href: '/my/reservations' }
        }
      />
    );
  }
  const showSupersededNotice =
    quoteSuperseded || (callbackCanRestart && quote?.isLatest === false);
  if (
    showSupersededNotice ||
    (quote &&
      (showCallbackError || (mode === 'checkout' && !quoteQuery.isError)))
  ) {
    const closeDialog = () => {
      if (showSupersededNotice) setSupersededDialogDismissed(true);
      else if (mode === 'checkout') setError('');
      else router.replace(callbackCanRestart ? checkoutHref : chatHref);
    };
    const dialogDescription = showSupersededNotice
      ? '재견적이 도착해서 이 견적으로는 결제할 수 없어요.'
      : callbackCanRestart
        ? retryMessage
        : error;

    return (
      <>
        {quote ? (
          <PaymentPage
            key={quoteId}
            quote={toQuoteDraft(quote)}
            photographerName={partner?.nickname ?? '담당 작가'}
            profileImageUrl={partner?.profileImageUrl ?? ''}
            representativeImageUrl={quote.representativeImageUrl ?? null}
            onPay={pay}
            pending={pending}
            revisedQuoteHref={
              showSupersededNotice || !quote.isLatest ? chatHref : undefined
            }
            checkoutLocked={showSupersededNotice || mode !== 'checkout'}
            paymentPending={quote.paymentPending}
            expired={quoteExpired || Date.parse(quote.shootAt) <= openedAt}
          />
        ) : (
          <StateMessage
            className={styles.state}
            title="재견적이 도착했어요"
            description="작가님이 재견적을 보내서 이 견적으로는 결제할 수 없어요."
            link={{ label: '재견적 보기', href: chatHref }}
          />
        )}
        <Modal
          open={
            showSupersededNotice
              ? mode !== 'checkout' && !supersededDialogDismissed
              : Boolean(error) || mode === 'fail'
          }
          onClose={closeDialog}
          closeOnBackdrop={false}
          variant="confirm"
          className={styles.paymentDialog}
          title={
            callbackCanRestart && !showSupersededNotice
              ? '결제를 완료하지 못했어요'
              : '결제를 진행할 수 없어요'
          }
          description={dialogDescription}
          footer={<Button onClick={closeDialog}>확인</Button>}
        />
      </>
    );
  }
  if (mode === 'fail' && quoteId && quoteQuery.isPending)
    return (
      <StateMessage
        className={styles.state}
        role="status"
        title="견적을 불러오고 있어요"
      />
    );
  if (mode === 'fail')
    return (
      <StateMessage
        className={styles.state}
        title="결제가 완료되지 않았어요"
        description={retryMessage}
        link={{
          label: '결제 페이지로 돌아가기',
          href: checkoutHref,
        }}
      />
    );
  if (mode === 'success') {
    if (!result)
      return (
        <StateMessage
          className={styles.state}
          role={error ? 'alert' : 'status'}
          title={error || '결제 결과를 확인하고 있어요'}
          description={
            restartRequired
              ? '결제 페이지로 돌아가 다시 진행해 주세요.'
              : checking
                ? '이 화면을 나가도 자동으로 처리돼요.'
                : '승인 결과 확인 전에는 결제를 다시 시작하지 마세요.'
          }
          {...(restartRequired
            ? {
                link: {
                  label: '결제 페이지로 돌아가기',
                  href: checkoutHref,
                },
              }
            : error || checking
              ? { link: { label: '채팅으로 가기', href: chatHref } }
              : {})}
        />
      );
    return (
      <PaymentCompletion
        reservationId={result.reservationId}
        reservationNumber={result.reservationNumber}
        amount={Number(params.get('amount'))}
        quote={quote}
        chatHref={chatHref}
      />
    );
  }
  if (!quoteId)
    return (
      <StateMessage
        className={styles.state}
        title="견적을 선택해 주세요"
        link={{ label: '문의 목록으로', href: '/chats' }}
      />
    );
  if (quoteQuery.isPending)
    return (
      <StateMessage
        className={styles.state}
        role="status"
        title="견적을 불러오고 있어요"
      />
    );
  return (
    <StateMessage
      className={styles.state}
      role="alert"
      title="견적을 불러오지 못했어요"
      button={{
        label: '다시 시도',
        onClick: () => void quoteQuery.refetch(),
      }}
    />
  );
}
