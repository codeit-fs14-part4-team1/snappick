import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(
  accountId: string,
  accountType: string,
): string {
  return jwt.sign(
    { sub: accountId, account_type: accountType }, // 토큰 안에 담을 내용
    env.jwtAccessSecret, // 서명에 쓰는 비밀 키
    {
      expiresIn: env.accessTokenTtl, // 만료 시간
    } as jwt.SignOptions,
  );
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
