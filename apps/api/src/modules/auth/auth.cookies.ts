import type { CookieOptions, Response, Request } from 'express';
import { env } from '../../config/env.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';

const sameSite: CookieOptions['sameSite'] =
  env.isProduction && process.env.COOKIE_SAMESITE === 'none' ? 'none' : 'lax';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite,
  path: '/auth',
};

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions,
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions);
}

export function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
