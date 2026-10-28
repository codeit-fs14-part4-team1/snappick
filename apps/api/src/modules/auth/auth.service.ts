import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../../utils/tokens.js';
import type { SignupInput } from './auth.schema.js';

export async function signup(input: SignupInput) {
  if (input.provider !== 'BASIC') {
    throw new HttpError(501, '소셜 가입은 아직 지원하지 않습니다.');
  }

  const email = input.provider_email!.trim().toLowerCase();

  // 이메일이 auth_provider 테이블에 존재할 시 연동으로 유도
  const existing = await prisma.auth_providers.findFirst({
    where: { provider_email: email },
    select: { id: true },
  });
  if (existing)
    throw new HttpError(
      409,
      '이미 가입된 이메일입니다. 로그인하여 연동을 진행해주세요',
    );

  const passwordHash = await argon2.hash(input.password!);
  const refreshToken = generateRefreshToken();

  const account = await prisma.auth_accounts.create({
    data: {
      account_type: input.account_type,
      auth_provider: {
        create: {
          provider: 'BASIC',
          provider_email: email,
          password_hash: passwordHash,
        },
      },
      ...(input.account_type === 'USER'
        ? { user: { create: { nickname: input.nickname } } }
        : { photographer: { create: { nickname: input.nickname } } }),
      auth_refresh_token: {
        create: { token_hash: hashToken(refreshToken) },
      },
    },
    select: { id: true, account_type: true },
  });

  return {
    accessToken: signAccessToken(account.id, account.account_type),
    refreshToken,
  };
}
