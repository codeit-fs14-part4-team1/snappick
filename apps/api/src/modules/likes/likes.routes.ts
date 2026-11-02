import { Router } from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import {
  getLikedPhotosHandler,
  getSavedPhotographersHandler,
  likePhotoHandler,
  savePhotographerHandler,
  unlikePhotoHandler,
  unsavePhotographerHandler,
} from './likes.controller.js';

// 좋아요·작가 저장은 일반 사용자만 (AU-03)
const userOnly = [authenticate, requireAccountType('USER')];

// app.use('/photos', photoLikesRouter)
export const photoLikesRouter: Router = Router();

photoLikesRouter.put('/:photoId/like', ...userOnly, likePhotoHandler);
photoLikesRouter.delete('/:photoId/like', ...userOnly, unlikePhotoHandler);

// app.use('/photographers', photographerSavesRouter)
export const photographerSavesRouter: Router = Router();

photographerSavesRouter.put(
  '/:photographerId/save',
  ...userOnly,
  savePhotographerHandler,
);
photographerSavesRouter.delete(
  '/:photographerId/save',
  ...userOnly,
  unsavePhotographerHandler,
);

// MY 픽: 일반 사용자 전용 (AU-03, 작가 계정에는 MY 픽이 없다)
// app.use('/me', myPickRouter)
export const myPickRouter: Router = Router();

myPickRouter.get('/liked-photos', ...userOnly, getLikedPhotosHandler);
myPickRouter.get(
  '/saved-photographers',
  ...userOnly,
  getSavedPhotographersHandler,
);
