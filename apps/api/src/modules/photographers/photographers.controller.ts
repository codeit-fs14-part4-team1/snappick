import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import {
  photographerParamsSchema,
  updateProfileSchema,
} from './photographers.schema.js';
import {
  getMyProfile,
  getMyReadiness,
  getPhotographerProfile,
  updateMyProfile,
} from './photographers.service.js';

export async function getPhotographerProfileHandler(
  req: Request,
  res: Response,
) {
  const { photographerId } = photographerParamsSchema.parse(req.params);
  res.vary('Authorization');
  res.json(await getPhotographerProfile(photographerId, req.auth));
}

export async function getMyProfileHandler(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  res.json(await getMyProfile(getAuth(req)));
}

export async function getMyReadinessHandler(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store'); // 프로필을 고친 직후 바로 반영돼야 함
  res.json(await getMyReadiness(getAuth(req)));
}

export async function updateMyProfileHandler(req: Request, res: Response) {
  const input = updateProfileSchema.parse(req.body);
  res.set('Cache-Control', 'no-store');
  res.json(await updateMyProfile(getAuth(req), input));
}
