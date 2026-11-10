import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { HttpError } from '../../utils/http-error.js';
import { resolveViewer } from '../../utils/viewer.js';
import {
  createReservationSchema,
  reservationParamsSchema,
  cancelReservationSchema,
} from './reservations.schema.js';
import {
  createReservation,
  getReservationDetail,
  createcancelReservation,
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
  res
    .status(201)
    .json(
      await createcancelReservation(
        { ...requester, accountId: auth.accountId },
        reservationId,
        reason,
      ),
    );
}
