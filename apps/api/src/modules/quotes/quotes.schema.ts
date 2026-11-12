import { z } from 'zod';

export const createQuoteSchema = z.object({
  chatRoomId: z.uuid(),
  productId: z.uuid(),
});
