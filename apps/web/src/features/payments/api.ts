import type { FetchWithAuth } from '@/features/auth/types';

export type PreparedPayment = {
  paymentId: string;
  orderId: string;
  orderName: string;
  amount: number;
  status: 'READY';
};

export type PaymentResult = {
  paymentId: string;
  status: 'SUCCEEDED';
  reservationId: string;
};

export async function preparePayment(
  quoteId: string,
  fetchWithAuth: FetchWithAuth,
) {
  const result = await fetchWithAuth<PreparedPayment>('/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId }),
  });
  if (
    !result?.orderId ||
    result.status !== 'READY' ||
    !Number.isSafeInteger(result.amount) ||
    result.amount < 0
  )
    throw new Error('결제 준비 응답을 확인하지 못했어요.');
  return result;
}

export async function confirmPayment(
  input: { paymentKey: string; orderId: string; amount: number },
  fetchWithAuth: FetchWithAuth,
) {
  const result = await fetchWithAuth<PaymentResult>('/payments/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!result?.reservationId || result.status !== 'SUCCEEDED')
    throw new Error('결제 결과를 확인하지 못했어요.');
  return result;
}
