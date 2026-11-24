import type { Request, Response } from 'express';

import { getAuth } from '../../middlewares/authenticate.js';
import {
  confirmPaymentSchema,
  preparePaymentSchema,
} from './payments.schema.js';
import { confirmPayment, preparePayment } from './payments.service.js';
import type { Server } from 'socket.io';
import { emitNotification } from '../notifications/notifications.emit.js';

export async function preparePaymentHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const input = preparePaymentSchema.parse(req.body);

  const { reused, ...result } = await preparePayment(auth.accountId, input);

  res.status(reused ? 200 : 201).json(result);
}

export async function confirmPaymentHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const input = confirmPaymentSchema.parse(req.body);

  const { notifications, ...result } = await confirmPayment(
    auth.accountId,
    input,
  );

  const io: Server = req.app.get('io');
  emitNotification(io, notifications);
  res.status(200).json(result);
}
