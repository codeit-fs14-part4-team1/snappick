import { z } from 'zod';

export const createQuoteSchema = z
  .object({
    chatRoomId: z.uuid(),
    shootingCaseId: z.uuid().optional(),
    expectedVersion: z.number().int().positive().optional(),
    productId: z.uuid().optional(),
    quoteName: z.string().trim().min(1).max(50),
    shootAt: z.iso.datetime({ offset: true }),
    location: z.string().trim().min(1),
    locationLat: z.number().min(-90).max(90),
    locationLng: z.number().min(-180).max(180),
    durationMinutes: z.number().int().min(60).max(2_880),
    price: z.number().int().min(0).max(100_000_000),
    photoCount: z.number().int().min(1).max(10_000),
    includesOriginal: z.boolean(),
    additionalNotice: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((input) => input.shootingCaseId || input.productId, {
    path: ['productId'],
    message: '새 견적을 작성할 촬영 상품을 선택해 주세요.',
  })
  .refine(
    (input) =>
      Boolean(input.shootingCaseId) === (input.expectedVersion !== undefined),
    {
      path: ['expectedVersion'],
      message: '재견적은 수정할 촬영 건과 기준 견적 버전을 함께 전달해 주세요.',
    },
  );

export const quoteIdParamsSchema = z.object({
  quoteId: z.uuid(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
