import { z } from 'zod';

export const createChatSchema = z.object({
  photographerId: z.uuid({
    error: 'photographerId는 올바른 UUID여야 합니다.',
  }),
});

export const sendMessageSchema = z.object({
  messageType: z.literal('TEXT').default('TEXT'),
  content: z.string().trim().min(1).max(1000),
});

export const chatRoomParamsSchema = z.object({
  chatRoomId: z.uuid({
    error: 'chatRoomId는 UUID여야 합니다',
  }),
});
