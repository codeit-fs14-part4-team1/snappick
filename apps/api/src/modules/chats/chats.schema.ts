import { z } from 'zod';

export const createChatSchema = z.object({
  photographerId: z.uuid({
    error: 'photographerId는 올바른 UUID여야 합니다.',
  }),
});

export const sendMessageSchema = z.object({
  messageType: z.literal('TEXT').default('TEXT'),
  content: z
    .string()
    .trim()
    .min(1, '메시지를 입력해 주세요')
    .max(1000, '메시지는 최대 1,000자까지 입력할 수 있습니다.'),
});

export const chatRoomParamsSchema = z.object({
  chatRoomId: z.uuid({
    error: 'chatRoomId는 UUID여야 합니다',
  }),
});
