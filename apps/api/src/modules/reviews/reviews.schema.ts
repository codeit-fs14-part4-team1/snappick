import { z } from 'zod';

export const photographerReviewsParamsSchema = z.object({
  photographerId: z.uuid(),
});

export const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(3),
});

export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;

export const createReviewSchema = z.object({
  reservationId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(200),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const reviewParamsSchema = z.object({
  reviewId: z.uuid(),
});

export const updateReviewSchema = createReviewSchema
  .pick({
    rating: true,
    comment: true,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: '수정할 항목을 하나 이상 보내주세요.',
  });

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const createReplySchema = z.object({
  comment: z.string().trim().min(1).max(1000),
});

export type CreateReplyInput = z.infer<typeof createReplySchema>;
