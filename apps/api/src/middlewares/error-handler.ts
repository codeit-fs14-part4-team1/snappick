import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: 'VALIDATION_FAILED',
      message: err.issues[0]?.message ?? '입력값이 올바르지 않습니다.',
    });
  }
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ code: err.code, message: err.message });
  }
  // express.json()이 깨진 JSON을 만났을 때 (지금은 500으로 빠질 수 있는 경우)
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: string }).type === 'entity.parse.failed'
  ) {
    return res.status(400).json({
      code: 'INVALID_JSON',
      message: '요청 본문이 올바른 JSON이 아닙니다.',
    });
  }
  console.error(err);
  return res
    .status(500)
    .json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' });
}
