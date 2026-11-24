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

const cancelReasonSchema = z
  .string({
    error: 'reason의 양식은 문자열이어야 합니다.',
  })
  .trim()
  .min(1, {
    error: 'reason의 최소 길이는 1 이상이어야 합니다.',
  })
  .max(1000, {
    error: 'reason의 최대 길이는 1000자 이내이어야 합니다.',
  });

export const cancelReservationSchema = z.object({
  reason: cancelReasonSchema,
});

export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;

// 수락할 때만 작가의 취소 사유를 받는다
export const patchCancelReservationSchema = z.discriminatedUnion(
  'status',
  [
    z.object({ status: z.literal('ACCEPTED'), reason: cancelReasonSchema }),
    z.object({ status: z.literal('REJECTED') }),
  ],
  { error: 'status는 반드시 ACCEPTED, REJECTED 중 하나이어야 합니다.' },
);

export type PatchCancelReservationInput = z.infer<
  typeof patchCancelReservationSchema
>;

export const getReservationSchema = z.object({
  type: z
    .enum(['ALL', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'], {
      error:
        'type은 반드시 ALL, UPCOMING, IN_PROGRESS, COMPLETED, CANCELED 중 하나여야 합니다.',
    })
    .default('ALL'),
  page: z.coerce
    .number({ error: 'page는 숫자여야 합니다.' })
    .int({ error: 'page는 정수여야 합니다.' })
    .min(1, { error: 'page의 최소값은 1 이상이어야 합니다.' })
    .default(1),
  pageSize: z.coerce
    .number({ error: 'pageSize는 숫자여야 합니다.' })
    .int({ error: 'pageSize는 정수여야 합니다.' })
    .min(1, { error: 'pageSize의 최소값은 1 이상이어야 합니다.' })
    .max(50, { error: 'pageSize의 최대값은 50 이하이어야 합니다.' })
    .default(10),
});

export type GetReservationInput = z.infer<typeof getReservationSchema>;

const deliverableLinkSchema = z
  .url({
    protocol: /^https?$/,
    error: 'link는 http 또는 https로 시작하는 주소여야 합니다.',
  })
  .max(2000, { error: 'link의 최대 길이는 2000자 이내이어야 합니다.' });

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// YYYY.MM.DD(한국 날짜)의 0시를 Date로 바꾼다
function kstDateStart(value: string): Date {
  const [year, month, day] = value.split('.').map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(year, month - 1, day) - KST_OFFSET_MS);
}

function todayKstStart(): Date {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
      KST_OFFSET_MS,
  );
}

// 링크 유효 기간은 시안대로 시각 없이 날짜(YYYY.MM.DD)만 받는다
// 그날까지 유효하므로 오늘 날짜부터 받을 수 있다
const deliverableExpirationSchema = z
  .string({ error: 'expirationPeriod의 양식은 문자열이어야 합니다.' })
  .regex(/^\d{4}\.\d{2}\.\d{2}$/, {
    error: 'expirationPeriod는 YYYY.MM.DD 형식이어야 합니다.',
  })
  // 2026.02.30처럼 없는 날짜는 다음 달로 넘어가므로 되돌려 비교해 막는다
  .refine(
    (value) => {
      const kst = new Date(kstDateStart(value).getTime() + KST_OFFSET_MS);
      const [year, month, day] = value.split('.').map(Number);
      return (
        kst.getUTCFullYear() === year &&
        kst.getUTCMonth() + 1 === month &&
        kst.getUTCDate() === day
      );
    },
    { error: 'expirationPeriod가 올바른 날짜가 아닙니다.' },
  )
  .transform(kstDateStart)
  .refine((date) => date.getTime() >= todayKstStart().getTime(), {
    error: 'expirationPeriod는 오늘 이후 날짜여야 합니다.',
  });

const deliverableNoticeSchema = z
  .string({ error: 'notice의 양식은 문자열이어야 합니다.' })
  .trim()
  .max(1000, { error: 'notice의 최대 길이는 1000자 이내이어야 합니다.' });

export const createDeliverableSchema = z.object({
  link: deliverableLinkSchema,
  expirationPeriod: deliverableExpirationSchema,
  notice: deliverableNoticeSchema.optional(),
});

export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;

// 보낸 항목만 수정한다. notice는 null을 보내면 지운다
export const patchDeliverableSchema = z
  .object({
    link: deliverableLinkSchema.optional(),
    expirationPeriod: deliverableExpirationSchema.optional(),
    notice: deliverableNoticeSchema.nullable().optional(),
  })
  .refine((input) => Object.values(input).some((v) => v !== undefined), {
    error: '수정할 항목을 하나 이상 보내야 합니다.',
  });

export type PatchDeliverableInput = z.infer<typeof patchDeliverableSchema>;
