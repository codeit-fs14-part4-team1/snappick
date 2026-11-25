'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getQuote, getChatRooms } from '@/features/chats/api';
import useChatRooms from '@/features/chats/useChatRooms';
import { toQuoteDraft } from '@/features/chats/quote';
import StateMessage from '@/components/ui/StateMessage';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { queryKeys } from '@/lib/queryKeys';
import { preparePayment, confirmPayment, type PaymentResult } from '../api';
import useTossPaymentWindow from '../useTossPaymentWindow';
import PaymentCompletion from './PaymentCompletion';
import PaymentPage from './PaymentPage';
import styles from './PaymentPage.module.css';

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
  const [restartRequired, setRestartRequired] = useState(false);
  const [paymentCanceled, setPaymentCanceled] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const started = useRef(false);
  const busy = useRef(false);
  const { active, openPaymentWindow } = useTossPaymentWindow();
  const quoteQuery = useQuery({
    queryKey: queryKeys.quotes.detail(quoteId),
    queryFn: ({ signal }) => getQuote(quoteId, fetchWithAuth, signal),
    enabled: Boolean(quoteId && user?.accountType === 'USER'),
    staleTime: 0,
  });
  const chatRoomId = quoteQuery.data?.chatRoomId ?? validReturnChatRoomId;
  const chatHref = chatRoomId
    ? `/chats/${encodeURIComponent(chatRoomId)}`
    : '/chats';
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
    setPaymentCanceled(false);
    try {
      // 서버는 orderId의 소유자와 DB 금액을 다시 검증합니다.
      const approved = await confirmPayment(
        { paymentKey, orderId, amount },
        fetchWithAuth,
      );
      setResult(approved);
      await Promise.allSettled([
        client.invalidateQueries({ queryKey: queryKeys.quotes.all }),
        client.invalidateQueries({
          queryKey: queryKeys.chats.all,
          refetchType: 'all',
        }),
        client.invalidateQueries({ queryKey: queryKeys.reservations.all }),
      ]);
    } catch (cause) {
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
        cause.code === 'PAYMENT_RETRY_REQUIRED'
      ) {
        setRestartRequired(true);
        setError('결제에 실패했어요');
        return;
      }
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'PAYMENT_CANCELED'
      ) {
        setPaymentCanceled(true);
        setError('예약할 수 없어 결제가 취소됐어요.');
        return;
      }
      setError(
        '결제 결과를 확인하지 못했어요. 결제 내역을 확인한 뒤 다시 시도해 주세요.',
      );
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

  async function pay() {
    if (busy.current || !user || !quoteQuery.data) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const payment = await preparePayment(quoteId, fetchWithAuth);
      if (!active.current) return;
      const query = new URLSearchParams({
        quoteId,
        chatRoomId: quoteQuery.data.chatRoomId,
      });

      if (payment.status === 'PENDING') {
        query.set('paymentKey', payment.paymentKey);
        query.set('orderId', payment.orderId);
        query.set('amount', String(payment.amount));
        router.replace(`/payments/success?${query}`);
        return;
      }

      await openPaymentWindow(user.id, payment, query);
    } catch (cause) {
      if (!active.current) return;
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'QUOTE_NOT_LATEST'
      ) {
        setQuoteSuperseded(true);
        void quoteQuery.refetch();
        return;
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

  const quote = quoteQuery.data;
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
    const resultUnknown =
      !showSupersededNotice &&
      mode === 'success' &&
      !restartRequired &&
      !paymentCanceled;
    const dialogDescription = showSupersededNotice
      ? '재견적이 도착해서 이 견적으로는 결제할 수 없어요.'
      : callbackCanRestart
        ? '현재 견적으로 다시 결제할 수 있어요.'
        : resultUnknown
          ? '결제가 정상적으로 끝나지 않았어요. 결제 내역에서 승인 여부를 확인한 뒤 다시 시도해 주세요.'
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
            resultUnknown
              ? '결제 결과를 확인하지 못했어요'
              : paymentCanceled
                ? '결제가 취소됐어요'
                : '결제를 진행할 수 없어요'
          }
          description={dialogDescription}
          footer={
            <Button onClick={closeDialog}>
              {resultUnknown ? '이전 페이지로' : '확인'}
            </Button>
          }
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
        description="결제창을 닫았거나 결제에 실패했어요. 다시 시도할 수 있어요."
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
              : paymentCanceled
                ? '채팅에서 작가님에게 문의해 주세요.'
                : '승인 결과 확인 전에는 결제를 다시 시작하지 마세요.'
          }
          {...(restartRequired
            ? {
                link: {
                  label: '결제 페이지로 돌아가기',
                  href: checkoutHref,
                },
              }
            : error
              ? { link: { label: '이전 페이지로', href: chatHref } }
              : {})}
        />
      );
    return (
      <PaymentCompletion
        reservationId={result.reservationId}
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
