import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { SignupInput } from './auth.schema.js';
import { issueTokens } from './token.service.js';

export async function signup(input: SignupInput) {
  if (input.provider !== 'BASIC') {
    throw new HttpError(
      501,
      'NOT_IMPLEMENTED',
      '소셜 가입은 아직 지원하지 않습니다.',
    );
  }

  const email = input.provider_email.trim().toLowerCase();

  // 이메일이 auth_provider 테이블에 존재할 시 연동으로 유도
  const existing = await prisma.auth_providers.findFirst({
    where: { provider_email: email },
    select: { id: true },
  });
  if (existing)
    throw new HttpError(
      409,
      'ACCOUNT_ALREADY_EXISTS',
      '이미 가입된 이메일입니다. 로그인하여 연동을 진행해주세요',
    );

  // 해시는 느려서 트랜잭션 밖에서 먼저 계산 (트랜잭션을 오래 잡지 않기 위해)
  const passwordHash = await argon2.hash(input.password);

  // 계정/provider/프로필/토큰을 모두 한 트랜잭션으로 묶음
  return prisma.$transaction(async (tx) => {
    const account = await tx.auth_accounts.create({
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
      },
      select: { id: true, account_type: true },
    });

    // 새 로그인 세션(family)의 시작: refresh token 행 저장 + 토큰 2개 발급
    return issueTokens(tx, account);
  });
}
