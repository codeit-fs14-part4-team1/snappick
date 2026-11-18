import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import {
  createProfileImageUploadUrlHandler,
  updateProfileImageHandler,
} from './profile-image.controller.js';

// 일반 사용자·작가 모두 자기 프로필 이미지를 바꿀 수 있다
// app.use('/me/profile-image', myProfileImageRouter)
export const myProfileImageRouter: Router = Router();

myProfileImageRouter.post(
  '/upload-url',
  authenticate,
  createProfileImageUploadUrlHandler,
);
myProfileImageRouter.patch('/', authenticate, updateProfileImageHandler);
