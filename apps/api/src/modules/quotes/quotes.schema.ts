import { z } from 'zod';

export const createQuoteSchema = z.object({
  chatRoomId: z.uuid(),
  productId: z.uuid(),
  shootAt: z.iso.datetime({ offset: true }),
  location: z.string().trim().min(1),
  durationMinutes: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  photoCount: z.number().int().positive().nullable().optional(),
  includesOriginal: z.boolean(),
  additionalNotice: z.string().trim().max(1000).nullable().optional(),
});

export const quoteIdParamsSchema = z.object({
  quoteId: z.uuid(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
