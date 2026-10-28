import type { Request, Response } from 'express';
import { setRefreshCookie } from './auth.cookies.js';
import { signupSchema } from './auth.schema.js';
import { signup } from './auth.service.js';

export async function signupHandler(req: Request, res: Response) {
  const input = signupSchema.parse(req.body);
  const { accessToken, refreshToken } = await signup(input);

  setRefreshCookie(res, refreshToken);
  res.status(201).json({ access_token: accessToken });
}
