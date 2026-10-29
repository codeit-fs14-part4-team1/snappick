import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { HttpError } from '../../utils/http-error.js';
import { resolveViewer } from '../feeds/viewer.js';
import {
  pageQuerySchema,
  photoLikeParamsSchema,
  photographerSaveParamsSchema,
} from './likes.schema.js';
import {
  likePhoto,
  savePhotographer,
  unlikePhoto,
  unsavePhotographer,
} from './likes.service.js';
import { getLikedPhotos, getSavedPhotographers } from './my-pick.service.js';

// requireAccountType('USER') 다음에 쓰므로 사용자 프로필이 있어야 한다
async function requireUserId(req: Request): Promise<string> {
  const { userId } = await resolveViewer(getAuth(req));
  if (!userId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  return userId;
}

export async function likePhotoHandler(req: Request, res: Response) {
  const { photoId } = photoLikeParamsSchema.parse(req.params);
  res.json(await likePhoto(await requireUserId(req), photoId));
}

export async function unlikePhotoHandler(req: Request, res: Response) {
  const { photoId } = photoLikeParamsSchema.parse(req.params);
  res.json(await unlikePhoto(await requireUserId(req), photoId));
}

export async function savePhotographerHandler(req: Request, res: Response) {
  const { photographerId } = photographerSaveParamsSchema.parse(req.params);
  res.json(await savePhotographer(await requireUserId(req), photographerId));
}

export async function unsavePhotographerHandler(req: Request, res: Response) {
  const { photographerId } = photographerSaveParamsSchema.parse(req.params);
  res.json(await unsavePhotographer(await requireUserId(req), photographerId));
}

export async function getLikedPhotosHandler(req: Request, res: Response) {
  const query = pageQuerySchema.parse(req.query);
  res.json(await getLikedPhotos(await requireUserId(req), query));
}

export async function getSavedPhotographersHandler(
  req: Request,
  res: Response,
) {
  const query = pageQuerySchema.parse(req.query);
  res.json(await getSavedPhotographers(await requireUserId(req), query));
}
