export type TossPaymentWindow = {
  on: (event: 'paymentRequest' | 'cancel', callback: () => void) => void;
  destroy: () => void;
};

type TossClient = {
  widgets: (options: { customerKey: string }) => {
    setAmount: (amount: { currency: 'KRW'; value: number }) => Promise<void>;
    renderPaymentWindow: (options: {
      orderName: string;
    }) => Promise<TossPaymentWindow>;
    requestPayment: (options: {
      orderId: string;
      orderName: string;
      successUrl: string;
      failUrl: string;
    }) => Promise<void>;
  };
};

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossClient;
  }
}

let loading: Promise<void> | undefined;

export async function loadToss() {
  if (window.TossPayments) return window.TossPayments;
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      loading = undefined;
      reject(new Error('결제창을 불러오지 못했어요. 다시 시도해 주세요.'));
    };
    const timer = setTimeout(fail, 15000);
    script.onload = () => {
      if (!window.TossPayments) return fail();
      clearTimeout(timer);
      resolve();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  await loading;
  if (!window.TossPayments) throw new Error('결제창을 불러오지 못했어요.');
  return window.TossPayments;
}
