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

// 비회원도 쓰는 API용: 토큰이 없으면 그대로 통과, 있으면 authenticate와 같은 규칙으로 검증
// 만료·위조 토큰은 401 (FE가 /auth/refresh 후 다시 요청)
export function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.headers.authorization === undefined) {
    next();
    return;
  }
  authenticate(req, res, next);
}

export function getAuth(req: Request): AccessTokenPayload {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
