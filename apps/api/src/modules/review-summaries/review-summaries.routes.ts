import { Router } from 'express';
import { getReviewSummaryHandler } from './review-summaries.controller.js';

// /photographers 아래에 연결한다 (인증 없음, 리뷰 목록과 같음)
export const reviewSummariesRouter: Router = Router();

reviewSummariesRouter.get(
  '/:photographerId/reviews/summary',
  getReviewSummaryHandler,
);
