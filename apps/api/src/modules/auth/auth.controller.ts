import type { Request, Response } from 'express';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './auth.cookies.js';
import { loginSchema, signupSchema } from './auth.schema.js';
import { signup, login } from './auth.service.js';
import { HttpError } from '../../utils/http-error.js';
import { rotateRefreshToken } from './token.service.js';

export async function signupHandler(req: Request, res: Response) {
  const input = signupSchema.parse(req.body);
  const { accessToken, refreshToken } = await signup(input);

  setRefreshCookie(res, refreshToken);
  res.status(201).json({ access_token: accessToken });
}

export async function loginHandler(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const { accessToken, refreshToken } = await login(input);

  setRefreshCookie(res, refreshToken);
  res.status(200).json({ access_token: accessToken });
}

export async function refreshHandler(req: Request, res: Response) {
  const rawToken = readRefreshCookie(req);
  if (!rawToken) {
    throw new HttpError(
      401,
      'INVALID_REFRESH_TOKEN',
      '유효하지 않은 refresh token입니다.',
    );
  }

  try {
    const { accessToken, refreshToken } = await rotateRefreshToken(rawToken);
    if (refreshToken) setRefreshCookie(res, refreshToken);
    res.status(200).json({ access_token: accessToken });
  } catch (error) {
    if (error instanceof HttpError && error.status === 401)
      clearRefreshCookie(res);
    throw error;
  }
}
