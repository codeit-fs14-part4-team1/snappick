import { Router } from 'express';
import { optionalAuthenticate } from '../../middlewares/authenticate.js';
import {
  getPhotoDetailHandler,
  getPhotographerPhotosHandler,
  getPhotosHandler,
} from './feeds.controller.js';

// 비회원도 쓰는 API라 선택 인증: 로그인했으면 liked·saved를 실제 값으로 응답

// app.use('/photos', photosRouter)
export const photosRouter: Router = Router();

photosRouter.get('/', optionalAuthenticate, getPhotosHandler);
photosRouter.get('/:photoId', optionalAuthenticate, getPhotoDetailHandler);

// app.use('/photographers', photographerPhotosRouter)
export const photographerPhotosRouter: Router = Router();

photographerPhotosRouter.get(
  '/:photographerId/photos',
  optionalAuthenticate,
  getPhotographerPhotosHandler,
);
