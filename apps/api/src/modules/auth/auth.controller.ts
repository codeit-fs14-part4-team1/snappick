import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { signupSchema } from './auth.schema.js';
import { signup } from './auth.service.js';

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/auth',
  maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
};

export async function signupHandler(req: Request, res: Response) {
  const input = signupSchema.parse(req.body);
  const { accessToken, refreshToken } = await signup(input);

  res.cookie('refresh_token', refreshToken, refreshCookieOptions);
  res.status(201).json({ access_token: accessToken });
}
