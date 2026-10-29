import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { getMe } from './users.service.js';

export async function getMeHandler(req: Request, res: Response) {
  const { accountId } = getAuth(req);
  const me = await getMe(accountId);

  res.set('Cache-Control', 'no-store');
  res.status(200).json(me);
}
