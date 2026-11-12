import { z } from 'zod';
import { Region, Style, Category } from '@snappick/shared';

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

export const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.uuid().optional(),
});

export const sendInquirySchema = z.object({
  messageType: z.literal('INITIAL_REQUEST'),
  payload: z
    .object({
      date: z.iso.date().optional(),
      timeSlot: z
        .enum(['MORNING', 'AFTERNOON', 'EVENING', 'UNDECIDED'])
        .optional(),
      region: z.enum(Region).optional(),
      location: z.string().trim().optional(),
      concept: z.array(z.enum(Style)).optional(),
      category: z.enum(Category).optional(),
    })
    .refine(
      (payload) =>
        Boolean(
          payload.date ||
          (payload.timeSlot && payload.timeSlot !== 'UNDECIDED') ||
          payload.region ||
          payload.location ||
          payload.concept?.length ||
          payload.category?.length,
        ),
      {
        message: '촬영 정보를 하나 이상 입력해 주세요.',
      },
    ),
});

export type InquiryPayload = z.infer<typeof sendInquirySchema>['payload'];
export const markChatAsReadSchema = z.object({
  lastReadMessageId: z.uuid({
    error: '마지막으로 확인한 메시지 ID를 확인해 주세요.',
  }),
});
