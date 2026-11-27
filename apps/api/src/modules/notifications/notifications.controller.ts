import type { Request, Response } from 'express';
import type { Server } from 'socket.io';
import { getAuth } from '../../middlewares/authenticate.js';
import { pageQuerySchema } from '../likes/likes.schema.js';
import {
  notificationParamsSchema,
  seenNotificationsSchema,
} from './notifications.schema.js';
import {
  getNotifications,
  hasUnreadNotifications,
  markNotificationsSeen,
  readNotification,
} from './notifications.service.js';

export async function getNotificationsHandler(req: Request, res: Response) {
  const query = pageQuerySchema.parse(req.query);
  res.json(await getNotifications(getAuth(req).accountId, query));
}

export async function hasUnreadNotificationsHandler(
  req: Request,
  res: Response,
) {
  res.json(await hasUnreadNotifications(getAuth(req).accountId));
}

export async function readNotificationHandler(req: Request, res: Response) {
  const { notificationId } = notificationParamsSchema.parse(req.params);
  res.json(await readNotification(getAuth(req).accountId, notificationId));
}

export async function markNotificationsSeenHandler(
  req: Request,
  res: Response,
) {
  const { accountId } = getAuth(req);
  const { notificationIds } = seenNotificationsSchema.parse(req.body);
  const result = await markNotificationsSeen(accountId, notificationIds);
  if (result.updatedCount > 0) {
    const io: Server | undefined = req.app.get('io');
    io?.to(`account:${accountId}`).emit('notification:seen');
  }
  res.json(result);
}
