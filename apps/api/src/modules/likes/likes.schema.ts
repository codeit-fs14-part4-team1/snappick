import { z } from 'zod';

export const photoLikeParamsSchema = z.object({
  photoId: z.uuid(),
});

export const photographerSaveParamsSchema = z.object({
  photographerId: z.uuid(),
});

export const pageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
