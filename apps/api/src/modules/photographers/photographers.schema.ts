import { z } from 'zod';

export const photographerParamsSchema = z.object({
  photographerId: z.uuid(),
});
