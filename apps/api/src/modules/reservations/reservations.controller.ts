import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { HttpError } from '../../utils/http-error.js';
import { resolveViewer } from '../feeds/viewer.js';
import { createReservationSchema } from './reservations.schema.js';
import { createReservation } from './reservations.service.js';

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
