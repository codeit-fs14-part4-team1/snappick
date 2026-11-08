import { z } from 'zod';

export const createReservationSchema = z.object({
  paymentId: z.uuid(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
