'use client';

import { useEffect, useRef } from 'react';
import { loadToss, type TossPaymentWindow } from './toss';

export default function useTossPaymentWindow() {
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

  async function openPaymentWindow(
    customerKey: string,
    payment: { orderId: string; orderName: string; amount: number },
    query: URLSearchParams,
  ) {
    const key = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!key?.startsWith('test_gck_')) {
      throw new Error(
        '토스 테스트 결제창형 클라이언트 키(test_gck_)를 설정해 주세요.',
      );
    }

    const TossPayments = await loadToss();
    if (!active.current) return;
    const widgets = TossPayments(key).widgets({ customerKey });
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

    try {
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
    } finally {
      paymentWindow.current?.destroy();
      paymentWindow.current = null;
    }
  }

  return { active, openPaymentWindow };
}
