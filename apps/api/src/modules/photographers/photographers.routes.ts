import { Router } from 'express';
import { optionalAuthenticate } from '../../middlewares/authenticate.js';
import { getPhotographerProfileHandler } from './photographers.controller.js';

export const photographersRouter: Router = Router();

photographersRouter.get(
  '/:photographerId',
  optionalAuthenticate,
  getPhotographerProfileHandler,
);
