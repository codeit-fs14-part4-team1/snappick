import { z } from 'zod';

export const createChatSchema = z.object({
  photographerId: z.uuid({
    error: 'photographerId는 올바른 UUID여야 합니다.',
  }),
});
