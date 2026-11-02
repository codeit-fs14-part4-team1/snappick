import { z } from 'zod';

export const productParamsSchema = z.object({
  photographerId: z.uuid(),
});
