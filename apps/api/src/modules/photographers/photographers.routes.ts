import { Router } from 'express';
import {
  authenticate,
  optionalAuthenticate,
} from '../../middlewares/authenticate.js';
import {
  getMyProfileHandler,
  getMyReadinessHandler,
  getPhotographerProfileHandler,
  updateMyProfileHandler,
} from './photographers.controller.js';

export const photographersRouter: Router = Router();

photographersRouter.get('/me', authenticate, getMyProfileHandler);
photographersRouter.get('/me/readiness', authenticate, getMyReadinessHandler);
photographersRouter.patch('/me', authenticate, updateMyProfileHandler);

photographersRouter.get(
  '/:photographerId',
  optionalAuthenticate,
  getPhotographerProfileHandler,
);
