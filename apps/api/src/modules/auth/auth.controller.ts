import type { Request, Response } from 'express';
import { setRefreshCookie } from './auth.cookies.js';
import { loginSchema, signupSchema } from './auth.schema.js';
import { signup, login } from './auth.service.js';

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
