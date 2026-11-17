import { z } from 'zod';

export const createQuoteSchema = z
  .object({
    chatRoomId: z.uuid(),
    shootingCaseId: z.uuid().optional(),
    productId: z.uuid().optional(),
    quoteName: z.string().trim().min(1).max(100),
    shootAt: z.iso.datetime({ offset: true }),
    location: z.string().trim().min(1),
    durationMinutes: z.number().int().positive(),
    price: z.number().int().nonnegative(),
    photoCount: z.number().int().positive().nullable().optional(),
    includesOriginal: z.boolean(),
    additionalNotice: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((input) => input.shootingCaseId || input.productId, {
    path: ['productId'],
    message: '새 견적을 작성할 촬영 상품을 선택해 주세요.',
  });

export const quoteIdParamsSchema = z.object({
  quoteId: z.uuid(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
