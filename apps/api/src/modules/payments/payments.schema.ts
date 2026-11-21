import { z } from 'zod';

export const preparePaymentSchema = z.object({
  quoteId: z.uuid({
    error: '견적 ID는 올바른 UUID여야 합니다.',
  }),
});

export type PreparePaymentInput = z.infer<typeof preparePaymentSchema>;

// 토스 결제 승인 요청값 검증
export const confirmPaymentSchema = z.object({
  paymentKey: z.string().min(1).max(200),
  orderId: z.uuid(),
  amount: z.number().int().nonnegative(),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

// 토스 승인 응답에서 확인할 항목
export const tossPaymentResponseSchema = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  totalAmount: z.number(),
  status: z.string(),
});
