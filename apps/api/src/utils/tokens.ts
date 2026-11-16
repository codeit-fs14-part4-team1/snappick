import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AccountType } from '@snappick/shared';
import { Provider } from '../generated/prisma/enums.js';

export type AccessTokenPayload = {
  accountId: string;
  accountType: AccountType;
  // 이번 로그인 세션을 시작한 로그인 방식 (BASIC, KAKAO 등)
  provider: Provider;
};

export function signAccessToken(
  accountId: string,
  accountType: string,
  provider: Provider,
): string {
  return jwt.sign(
    { sub: accountId, accountType, provider }, // 토큰 안에 담을 내용
    env.jwtAccessSecret, // 서명에 쓰는 비밀 키
    {
      expiresIn: env.accessTokenTtl, // 만료 시간
    } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwtAccessSecret, {
    algorithms: ['HS256'],
  });

  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    !Object.values(AccountType).includes(payload.accountType) ||
    // provider가 없는 예전 토큰도 거부한다 (401 → FE가 refresh로 새 토큰을 받는다)
    !Object.values(Provider).includes(payload.provider)
  ) {
    throw new Error('Invalid access token payload');
  }

  return {
    accountId: payload.sub,
    accountType: payload.accountType as AccountType,
    provider: payload.provider as Provider,
  };
}

export function verifySocketAccessToken(token: string) {
  const auth = verifyAccessToken(token);
  const payload = jwt.decode(token);

  if (
    !payload ||
    typeof payload === 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('Invalid socket token expiration');
  }

  return {
    ...auth,
    expiresAt: payload.exp,
  };
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
