import { z } from 'zod';

export const notificationParamsSchema = z.object({
  notificationId: z.uuid('요청 값이 올바르지 않아요.'),
});

export const seenNotificationsSchema = z.object({
  notificationIds: z.array(z.uuid()).min(1).max(100),
});
