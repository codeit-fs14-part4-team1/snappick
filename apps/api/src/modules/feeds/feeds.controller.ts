import type { Request, Response } from 'express';
import {
  photoParamsSchema,
  photographerParamsSchema,
  photographerPhotosQuerySchema,
  photosQuerySchema,
} from './feeds.schema.js';
import {
  getPhotoDetail,
  getPhotographerPhotos,
  getPhotos,
} from './feeds.service.js';
import { resolveViewer } from './viewer.js';

// 로그인 여부에 따라 liked·saved가 달라지므로 캐시가 응답을 섞지 않게 한다
const varyByAuth = (res: Response) => res.vary('Authorization');

export async function getPhotosHandler(req: Request, res: Response) {
  const query = photosQuerySchema.parse(req.query);
  const viewer = await resolveViewer(req.auth);
  varyByAuth(res);
  res.json(await getPhotos(query, viewer));
}

export async function getPhotoDetailHandler(req: Request, res: Response) {
  const { photoId } = photoParamsSchema.parse(req.params);
  const viewer = await resolveViewer(req.auth);
  varyByAuth(res);
  res.json(await getPhotoDetail(photoId, viewer));
}

export async function getPhotographerPhotosHandler(
  req: Request,
  res: Response,
) {
  const { photographerId } = photographerParamsSchema.parse(req.params);
  const query = photographerPhotosQuerySchema.parse(req.query);
  const viewer = await resolveViewer(req.auth);
  varyByAuth(res);
  res.json(await getPhotographerPhotos(photographerId, query, viewer));
}
