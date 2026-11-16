import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { getMe, updateUserNickname } from './users.service.js';
import { updateUserNicknameSchema } from './users.schema.js';

export async function getMeHandler(req: Request, res: Response) {
  const { accountId } = getAuth(req);
  const me = await getMe(accountId);

  res.set('Cache-Control', 'no-store');
  res.status(200).json(me);
}

export async function updateUserNicknameHandler(req: Request, res: Response) {
  const { accountId } = getAuth(req);
  const input = updateUserNicknameSchema.parse(req.body);
  res.set('Cache-Control', 'no-store');
  res.json(await updateUserNickname(accountId, input));
}
