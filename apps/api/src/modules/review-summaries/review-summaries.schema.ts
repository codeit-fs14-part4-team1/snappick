import { z } from 'zod';

export const reviewSummaryParamsSchema = z.object({
  photographerId: z.uuid(),
});
