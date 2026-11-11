import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { pageQuerySchema } from '../likes/likes.schema.js';
import { notificationParamsSchema } from './notifications.schema.js';
import {
  getNotifications,
  hasUnreadNotifications,
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
