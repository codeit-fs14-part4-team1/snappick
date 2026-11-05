import { Router } from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import {
  getMyReviewsHandler,
  getPhotographerReviewsHandler,
  createReviewHandler,
} from './reviews.controller.js';

export const photographerReviewsRouter: Router = Router();

photographerReviewsRouter.get(
  '/:photographerId/reviews',
  getPhotographerReviewsHandler,
);

export const myReviewsRouter: Router = Router();

myReviewsRouter.get(
  '/reviews',
  authenticate,
  requireAccountType('USER'),
  getMyReviewsHandler,
);

myReviewsRouter.post(
  '/reviews',
  authenticate,
  requireAccountType('USER'),
  createReviewHandler,
);
