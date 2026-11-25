'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getQuote, getChatRooms } from '@/features/chats/api';
import useChatRooms from '@/features/chats/useChatRooms';
import {
  toQuoteDraft,
  formatQuoteDate,
  formatQuoteTime,
} from '@/features/chats/quote';
import StateMessage from '@/components/ui/StateMessage';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PageContainer from '@/components/layout/PageContainer';
import { queryKeys } from '@/lib/queryKeys';
import { preparePayment, confirmPayment, type PaymentResult } from '../api';
import { loadToss, type TossPaymentWindow } from '../toss';
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
  const [result, setResult] = useState<PaymentResult | null>(null);
  const started = useRef(false);
  const busy = useRef(false);
  const paymentWindow = useRef<TossPaymentWindow | null>(null);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      paymentWindow.current?.destroy();
      paymentWindow.current = null;
    };
  }, []);
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
    // 승인 요청은 콜백 진입 시 한 번만 시작합니다. 재시도는 버튼으로 요청합니다.
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

      const key = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!key?.startsWith('test_gck_'))
        throw new Error(
          '토스 테스트 결제창형 클라이언트 키(test_gck_)를 설정해 주세요.',
        );
      const TossPayments = await loadToss();
      if (!active.current) return;
      const widgets = TossPayments(key).widgets({ customerKey: user.id });
      await widgets.setAmount({ currency: 'KRW', value: payment.amount });
      if (!active.current) return;
      const checkoutWindow = await widgets.renderPaymentWindow({
        orderName: payment.orderName,
      });
      if (!active.current) {
        checkoutWindow.destroy();
        return;
      }
      paymentWindow.current = checkoutWindow;
      // 창을 닫거나 요청이 실패할 때까지 중복 결제창 생성을 막습니다.
      await new Promise<void>((resolve, reject) => {
        let requesting = false;
        checkoutWindow.on('cancel', resolve);
        checkoutWindow.on('paymentRequest', () => {
          if (requesting || !active.current) return;
          requesting = true;
          void widgets
            .requestPayment({
              orderId: payment.orderId,
              orderName: payment.orderName,
              successUrl: `${window.location.origin}/payments/success?${query}`,
              failUrl: `${window.location.origin}/payments/fail?${query}`,
            })
            .then(resolve, reject);
        });
      });
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
      paymentWindow.current?.destroy();
      paymentWindow.current = null;
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
        button={{ label: '예약 상세 보기', onClick: () => {}, disabled: true }}
      />
    );
  }
  if (quoteSuperseded || (callbackCanRestart && quote?.isLatest === false)) {
    const dismissDialog = () => setSupersededDialogDismissed(true);
    const supersededNotice = quote ? (
      <PaymentPage
        key={quoteId}
        quote={toQuoteDraft(quote)}
        photographerName={partner?.nickname ?? '담당 작가'}
        profileImageUrl={partner?.profileImageUrl ?? ''}
        onPay={pay}
        pending={pending}
        revisedQuoteHref={chatHref}
        checkoutLocked
      />
    ) : (
      <StateMessage
        className={styles.state}
        title="재견적이 도착했어요"
        description="작가님이 재견적을 보내서 이 견적으로는 결제할 수 없어요."
        link={{ label: '재견적 보기', href: chatHref }}
      />
    );
    return (
      <>
        {supersededNotice}
        <Modal
          open={mode !== 'checkout' && !supersededDialogDismissed}
          onClose={dismissDialog}
          closeOnBackdrop={false}
          variant="confirm"
          className={styles.paymentDialog}
          title="결제를 진행할 수 없어요"
          description="재견적이 도착해서 이 견적으로는 결제할 수 없어요."
          footer={<Button onClick={dismissDialog}>확인</Button>}
        />
      </>
    );
  }
  if (
    quote &&
    (showCallbackError || (mode === 'checkout' && !quoteQuery.isError))
  ) {
    const closeDialog = () => {
      if (mode === 'checkout') setError('');
      else router.replace(callbackCanRestart ? checkoutHref : chatHref);
    };
    const dialogTitle =
      mode === 'success' && !restartRequired
        ? '결제 결과를 확인하지 못했어요'
        : '결제를 진행할 수 없어요';

    return (
      <>
        <PaymentPage
          key={quoteId}
          quote={toQuoteDraft(quote)}
          photographerName={partner?.nickname ?? '담당 작가'}
          profileImageUrl={partner?.profileImageUrl ?? ''}
          onPay={pay}
          pending={pending}
          revisedQuoteHref={quote.isLatest ? undefined : chatHref}
          checkoutLocked={mode !== 'checkout'}
        />
        <Modal
          open={Boolean(error) || mode === 'fail'}
          onClose={closeDialog}
          closeOnBackdrop={false}
          variant="confirm"
          className={styles.paymentDialog}
          title={dialogTitle}
          description={
            callbackCanRestart
              ? '현재 견적으로 다시 결제할 수 있어요.'
              : mode === 'success'
                ? '결제가 정상적으로 끝나지 않았어요. 결제 내역에서 승인 여부를 확인한 뒤 다시 시도해 주세요.'
                : error
          }
          footer={
            <Button onClick={closeDialog}>
              {mode === 'success' && !restartRequired
                ? '이전 페이지로'
                : '확인'}
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
      <PageContainer className={styles.completion}>
        <div className={styles.successIcon} aria-hidden="true">
          ✓
        </div>
        <h1>결제가 완료됐어요</h1>
        <p>예약이 확정됐어요. 예약 내역에서 확인해 주세요.</p>
        <div className={styles.receipt}>
          <dl className={styles.rows}>
            <div>
              <dt>예약 번호</dt>
              <dd>{result.reservationId}</dd>
            </div>
            <div>
              <dt>견적명</dt>
              <dd>{quoteQuery.data?.quoteName ?? '결제한 견적'}</dd>
            </div>
            {quoteQuery.data && (
              <>
                <div>
                  <dt>촬영 일시</dt>
                  <dd>
                    {formatQuoteDate(toQuoteDraft(quoteQuery.data).date)}{' '}
                    {formatQuoteTime(toQuoteDraft(quoteQuery.data).startTime)}
                  </dd>
                </div>
                <div>
                  <dt>촬영 장소</dt>
                  <dd>{quoteQuery.data.location}</dd>
                </div>
              </>
            )}
            <div>
              <dt>결제 수단</dt>
              <dd>토스페이먼츠</dd>
            </div>
            <div>
              <dt>결제 금액</dt>
              <dd>{Number(params.get('amount')).toLocaleString('ko-KR')}원</dd>
            </div>
          </dl>
        </div>
        <div className={styles.completionActions}>
          <Link className={styles.backLink} href={chatHref}>
            채팅으로 돌아가기
          </Link>
          <Button variant="outline" size="lg" disabled>
            예약 상세 보기
          </Button>
        </div>
      </PageContainer>
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
