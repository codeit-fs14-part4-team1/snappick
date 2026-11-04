import { Router } from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import {
  getMyPhotoHandler,
  updateMyPhotosHandler,
} from './my-photos.controller.js';

// 사진 관리는 작가만
const photographerOnly = [authenticate, requireAccountType('PHOTOGRAPHER')];

// app.use('/me/photos', myPhotosRouter)
export const myPhotosRouter: Router = Router();

myPhotosRouter.patch('/batch', ...photographerOnly, updateMyPhotosHandler);
myPhotosRouter.get('/:photoId', ...photographerOnly, getMyPhotoHandler);
