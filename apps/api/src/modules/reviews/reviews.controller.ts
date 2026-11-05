import type { Request, Response } from 'express';
import { getAuth } from '../../middlewares/authenticate.js';
import { HttpError } from '../../utils/http-error.js';
import { resolveViewer } from '../feeds/viewer.js';
import {
  createReplySchema,
  createReviewSchema,
  photographerReviewsParamsSchema,
  reviewParamsSchema,
  reviewsQuerySchema,
  updateReviewSchema,
} from './reviews.schema.js';
import {
  getMyReviews,
  getPhotographerReviews,
  createReview,
  updateMyReview,
  deleteMyReview,
  createReply,
  updateReply,
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

export async function updateReviewHandler(req: Request, res: Response) {
  const { reviewId } = reviewParamsSchema.parse(req.params);
  const input = updateReviewSchema.parse(req.body);
  res.json(await updateMyReview(await requireUserId(req), reviewId, input));
}

export async function deleteReviewHandler(req: Request, res: Response) {
  const { reviewId } = reviewParamsSchema.parse(req.params);
  await deleteMyReview(await requireUserId(req), reviewId);
  res.status(204).end();
}

async function requirePhotographerId(req: Request): Promise<string> {
  const { photographerId } = await resolveViewer(getAuth(req));
  if (!photographerId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  return photographerId;
}

export async function createReplyHandler(req: Request, res: Response) {
  const { reviewId } = reviewParamsSchema.parse(req.params);
  const input = createReplySchema.parse(req.body);
  res
    .status(201)
    .json(await createReply(await requirePhotographerId(req), reviewId, input));
}

export async function updateReplyHandler(req: Request, res: Response) {
  const { reviewId } = reviewParamsSchema.parse(req.params);
  const input = createReplySchema.parse(req.body);
  res.json(
    await updateReply(await requirePhotographerId(req), reviewId, input),
  );
}
