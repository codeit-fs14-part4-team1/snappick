import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { requirePhotographerId } from '../feeds/viewer.js';
import {
  myPhotoParamsSchema,
  photoBatchBodySchema,
} from './my-photos.schema.js';
import { getMyPhoto, updateMyPhotos } from './my-photos.service.js';

export async function getMyPhotoHandler(req: Request, res: Response) {
  const { photoId } = myPhotoParamsSchema.parse(req.params);
  res.json(
    await getMyPhoto(await requirePhotographerId(getAuth(req)), photoId),
  );
}

export async function updateMyPhotosHandler(req: Request, res: Response) {
  const body = photoBatchBodySchema.parse(req.body);
  res.json(
    await updateMyPhotos(await requirePhotographerId(getAuth(req)), body),
  );
}
