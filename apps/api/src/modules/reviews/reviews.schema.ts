import { z } from 'zod';

export const photographerReviewsParamsSchema = z.object({
  photographerId: z.uuid(),
});

export const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(3),
});

export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;
