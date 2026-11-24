import type { Server } from 'socket.io';
import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { HttpError } from '../../utils/http-error.js';
import { requirePhotographerId, resolveViewer } from '../../utils/viewer.js';
import {
  createReservationSchema,
  reservationParamsSchema,
  cancelReservationSchema,
  cancelRequestParamsSchema,
  patchCancelReservationSchema,
  getReservationSchema,
  createDeliverableSchema,
  patchDeliverableSchema,
} from './reservations.schema.js';
import {
  createReservation,
  getReservationDetail,
  createCancelReservation,
  patchCancelReservation,
  getReservation,
  getDeliverable,
  createDeliverable,
  patchDeliverable,
} from './reservations.service.js';
import { emitNotification } from '../notifications/notifications.emit.js';

async function requireUserId(req: Request): Promise<string> {
  const { userId } = await resolveViewer(getAuth(req));
  if (!userId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  return userId;
}

export async function createReservationHandler(req: Request, res: Response) {
  const input = createReservationSchema.parse(req.body);
  const { notifications, ...result } = await createReservation(
    await requireUserId(req),
    input,
  );
  const io: Server = req.app.get('io');
  emitNotification(io, notifications);
  res.status(201).json(result);
}

export async function getReservationDetailHandler(req: Request, res: Response) {
  const { reservationId } = reservationParamsSchema.parse(req.params);
  const auth = getAuth(req);
  const viewer = await resolveViewer(auth);
  if (!viewer.userId && !viewer.photographerId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  res.json(await getReservationDetail(viewer, auth.accountId, reservationId));
}

export async function createCancelReservationHandler(
  req: Request,
  res: Response,
) {
  const { reservationId } = reservationParamsSchema.parse(req.params);
  const reason = cancelReservationSchema.parse(req.body);
  const auth = getAuth(req);
  const requester = await resolveViewer(auth);
  if (!requester.userId && !requester.photographerId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  const { notifications, systemMessage, ...result } =
    await createCancelReservation(
      { ...requester, accountId: auth.accountId },
      reservationId,
      reason,
    );
  const io: Server = req.app.get('io');
  emitNotification(io, notifications);
  if (systemMessage) {
    io.to(`chat:${systemMessage.chat_room_id}`).emit('message:new', {
      id: systemMessage.id,
      chatRoomId: systemMessage.chat_room_id,
      recipientAccountId: systemMessage.recipient_account_id,
      messageType: systemMessage.message_type,
      content: systemMessage.content,
      payload: systemMessage.payload,
      quote: null,
      reservation: null,
      readAt: systemMessage.read_at,
      createdAt: systemMessage.created_at,
    });
  }

  res.status(201).json(result);
}

export async function patchCancelReservationHandler(
  req: Request,
  res: Response,
) {
  const { reservationId, cancelRequestId } = cancelRequestParamsSchema.parse(
    req.params,
  );
  const input = patchCancelReservationSchema.parse(req.body);
  const photographerId = await requirePhotographerId(getAuth(req));
  const { notifications, systemMessage, ...result } =
    await patchCancelReservation(
      photographerId,
      reservationId,
      cancelRequestId,
      input,
    );
  const io: Server = req.app.get('io');
  emitNotification(io, notifications);
  if (systemMessage) {
    io.to(`chat:${systemMessage.chat_room_id}`).emit('message:new', {
      id: systemMessage.id,
      chatRoomId: systemMessage.chat_room_id,
      recipientAccountId: systemMessage.recipient_account_id,
      messageType: systemMessage.message_type,
      content: systemMessage.content,
      payload: systemMessage.payload,
      quote: null,
      reservation: null,
      readAt: systemMessage.read_at,
      createdAt: systemMessage.created_at,
    });
  }

  res.json(result);
}

export async function getReservationHandler(req: Request, res: Response) {
  const query = getReservationSchema.parse(req.query);
  const viewer = await resolveViewer(getAuth(req));
  if (!viewer.userId && !viewer.photographerId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  res.json(await getReservation(viewer, query));
}

export async function getDeliverableHandler(req: Request, res: Response) {
  const { reservationId } = reservationParamsSchema.parse(req.params);
  const viewer = await resolveViewer(getAuth(req));
  if (!viewer.userId && !viewer.photographerId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  res.json(await getDeliverable(viewer, reservationId));
}

export async function createDeliverableHandler(req: Request, res: Response) {
  const { reservationId } = reservationParamsSchema.parse(req.params);
  const input = createDeliverableSchema.parse(req.body);
  const photographerId = await requirePhotographerId(getAuth(req));
  const { notifications, ...result } = await createDeliverable(
    photographerId,
    reservationId,
    input,
  );
  const io: Server = req.app.get('io');
  emitNotification(io, notifications);
  res.status(201).json(result);
}

export async function patchDeliverableHandler(req: Request, res: Response) {
  const { reservationId } = reservationParamsSchema.parse(req.params);
  const input = patchDeliverableSchema.parse(req.body);
  const photographerId = await requirePhotographerId(getAuth(req));
  res.json(await patchDeliverable(photographerId, reservationId, input));
}
