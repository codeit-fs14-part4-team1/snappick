import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import {
  profileImageUploadUrlBodySchema,
  updateProfileImageBodySchema,
} from './profile-image.schema.js';
import {
  createProfileImageUploadUrl,
  updateProfileImage,
} from './profile-image.service.js';

export async function createProfileImageUploadUrlHandler(
  req: Request,
  res: Response,
) {
  const body = profileImageUploadUrlBodySchema.parse(req.body);
  const apiOrigin = `${req.protocol}://${req.get('host')}`;
  res.json(await createProfileImageUploadUrl(getAuth(req), body, apiOrigin));
}

export async function updateProfileImageHandler(req: Request, res: Response) {
  const body = updateProfileImageBodySchema.parse(req.body);
  res.json(await updateProfileImage(getAuth(req), body));
}
