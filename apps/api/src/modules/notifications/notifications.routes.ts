import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import {
  getNotificationsHandler,
  hasUnreadNotificationsHandler,
  readNotificationHandler,
} from './notifications.controller.js';

// 일반 사용자·작가 모두 자기 알림을 본다
// app.use('/me/notifications', notificationsRouter)
export const notificationsRouter: Router = Router();

notificationsRouter.get('/', authenticate, getNotificationsHandler);
notificationsRouter.get(
  '/has-unread',
  authenticate,
  hasUnreadNotificationsHandler,
);
notificationsRouter.patch(
  '/:notificationId/read',
  authenticate,
  readNotificationHandler,
);
