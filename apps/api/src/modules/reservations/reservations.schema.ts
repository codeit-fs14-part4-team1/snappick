import { z } from 'zod';

export const createReservationSchema = z.object({
  paymentId: z.uuid({
    error: 'paymentId는 올바른 UUID여야 합니다.',
  }),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const reservationParamsSchema = z.object({
  reservationId: z.uuid({
    error: 'reservationId는 올바른 UUID여야 합니다.',
  }),
});

export const cancelRequestParamsSchema = reservationParamsSchema.extend({
  cancelRequestId: z.uuid({
    error: 'cancelRequestId는 올바른 UUID여야 합니다.',
  }),
});

export const cancelReservationSchema = z.object({
  reason: z
    .string({
      error: 'reason의 양식은 문자열이어야 합니다.',
    })
    .trim()
    .min(1, {
      error: 'reason의 최소 길이는 1 이상이어야 합니다.',
    })
    .max(1000, {
      error: 'reason의 최대 길이는 1000자 이내이어야 합니다.',
    }),
});

export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;

export const patchCancelReservationSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED'], {
    error: 'status는 반드시 ACCEPTED, REJECTED 중 하나이어야 합니다.',
  }),
});

export type PatchCancelReservationInput = z.infer<
  typeof patchCancelReservationSchema
>;
