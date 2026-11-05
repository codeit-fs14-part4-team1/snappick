import { Router } from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import {
  getMyReviewsHandler,
  getPhotographerReviewsHandler,
  createReviewHandler,
  updateReviewHandler,
  deleteReviewHandler,
  createReplyHandler,
  updateReplyHandler,
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

myReviewsRouter.patch(
  '/reviews/:reviewId',
  authenticate,
  requireAccountType('USER'),
  updateReviewHandler,
);

myReviewsRouter.delete(
  '/reviews/:reviewId',
  authenticate,
  requireAccountType('USER'),
  deleteReviewHandler,
);

photographerReviewsRouter.post(
  '/me/reviews/:reviewId/reply',
  authenticate,
  requireAccountType('PHOTOGRAPHER'),
  createReplyHandler,
);

photographerReviewsRouter.patch(
  '/me/reviews/:reviewId/reply',
  authenticate,
  requireAccountType('PHOTOGRAPHER'),
  updateReplyHandler,
);
