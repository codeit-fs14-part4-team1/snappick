import type { Request, Response } from 'express';
import { photographerParamsSchema } from './photographers.schema.js';
import { getPhotographerProfile } from './photographers.service.js';

export async function getPhotographerProfileHandler(
  req: Request,
  res: Response,
) {
  const { photographerId } = photographerParamsSchema.parse(req.params);
  res.vary('Authorization'); // 로그인 여부에 따라 saved·isSelf가 달라짐
  res.json(await getPhotographerProfile(photographerId, req.auth));
}
