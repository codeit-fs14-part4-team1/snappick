import { z } from 'zod';

// 결제 준비 요청에 필요한 견적 ID 검증
export const preparePaymentSchema = z.object({
  quoteId: z.uuid({
    error: '견적 ID는 올바른 UUID여야 합니다.',
  }),
});

// 검증된 요청값을 서비스에서 사용하기 위한 타입
export type PreparePaymentInput = z.infer<typeof preparePaymentSchema>;
