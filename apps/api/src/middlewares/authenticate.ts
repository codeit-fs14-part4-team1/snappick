import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';
import { type AccessTokenPayload, verifyAccessToken } from '../utils/tokens.js';

// 모든 에러 401 통일
const unauthorized = () =>
  new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');

// Authorization: Bearer <access_token>
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw unauthorized();

  try {
    req.auth = verifyAccessToken(token);
  } catch {
    throw unauthorized();
  }

  next();
}

export function getAuth(req: Request): AccessTokenPayload {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
