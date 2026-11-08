import { z } from 'zod';

export const createReservationSchema = z.object({
  paymentId: z.uuid({
    error: 'paymentId는 올바른 UUID여야 합니다.',
  }),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
