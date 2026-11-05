import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { HttpError } from '../../utils/http-error.js';
import { resolveViewer } from '../feeds/viewer.js';
import {
  createReviewSchema,
  photographerReviewsParamsSchema,
  reviewsQuerySchema,
} from './reviews.schema.js';
import {
  getMyReviews,
  getPhotographerReviews,
  createReview,
} from './reviews.service.js';

async function requireUserId(req: Request): Promise<string> {
  const { userId } = await resolveViewer(getAuth(req));
  if (!userId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  return userId;
}

export async function getPhotographerReviewsHandler(
  req: Request,
  res: Response,
) {
  const { photographerId } = photographerReviewsParamsSchema.parse(req.params);
  const query = reviewsQuerySchema.parse(req.query);
  res.json(await getPhotographerReviews(photographerId, query));
}

export async function getMyReviewsHandler(req: Request, res: Response) {
  const query = reviewsQuerySchema.parse(req.query);
  res.json(await getMyReviews(await requireUserId(req), query));
}

export async function createReviewHandler(req: Request, res: Response) {
  const input = createReviewSchema.parse(req.body);
  res.status(201).json(await createReview(await requireUserId(req), input));
}
