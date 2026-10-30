import { Router } from 'express';
import {
  authenticate,
  optionalAuthenticate,
} from '../../middlewares/authenticate.js';
import {
  getMyProfileHandler,
  getPhotographerProfileHandler,
  updateMyProfileHandler,
} from './photographers.controller.js';

export const photographersRouter: Router = Router();

photographersRouter.get('/me', authenticate, getMyProfileHandler);
photographersRouter.patch('/me', authenticate, updateMyProfileHandler);

photographersRouter.get(
  '/:photographerId',
  optionalAuthenticate,
  getPhotographerProfileHandler,
);
