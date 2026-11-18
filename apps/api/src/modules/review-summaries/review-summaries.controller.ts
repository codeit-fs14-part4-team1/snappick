import type { Request, Response } from 'express';
import { reviewSummaryParamsSchema } from './review-summaries.schema.js';
import {
  generateReviewSummary,
  getReviewSummary,
} from './review-summaries.service.js';

export async function getReviewSummaryHandler(req: Request, res: Response) {
  const { photographerId } = reviewSummaryParamsSchema.parse(req.params);
  const { body, shouldGenerate } = await getReviewSummary(photographerId);
  res.json(body);

  // 응답을 보낸 뒤 만든다. 실패해도 조회 응답에는 영향이 없고, 다음 조회 때 다시 판단한다
  if (shouldGenerate) {
    generateReviewSummary(photographerId).catch((error: unknown) => {
      console.error('리뷰 요약 생성 실패', photographerId, error);
    });
  }
}
