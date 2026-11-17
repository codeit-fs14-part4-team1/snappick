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
} from './reservations.schema.js';
import {
  createReservation,
  getReservationDetail,
  createCancelReservation,
  patchCancelReservation,
  getReservation,
} from './reservations.service.js';

async function requireUserId(req: Request): Promise<string> {
  const { userId } = await resolveViewer(getAuth(req));
  if (!userId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  return userId;
}

export async function createReservationHandler(req: Request, res: Response) {
  const input = createReservationSchema.parse(req.body);
  res
    .status(201)
    .json(await createReservation(await requireUserId(req), input));
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
  const { systemMessage, ...result } = await createCancelReservation(
    { ...requester, accountId: auth.accountId },
    reservationId,
    reason,
  );

  if (systemMessage) {
    const io: Server = req.app.get('io');

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
  const { systemMessage, ...result } = await patchCancelReservation(
    photographerId,
    reservationId,
    cancelRequestId,
    input,
  );

  if (systemMessage) {
    const io: Server = req.app.get('io');

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
