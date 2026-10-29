import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { SignupInput, LoginInput } from './auth.schema.js';
import { issueTokens } from './token.service.js';
import { Provider } from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';

const DUMMY_HASH = await argon2.hash('timing-dummy-password');

async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // 해시 형식이 이상한 경우(시드 계정의 가짜 해시)도 불일치로 처리
  }
}

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
      '이미 가입된 이메일입니다.',
    );

  // 해시는 느려서 트랜잭션 밖에서 먼저 계산 (트랜잭션을 오래 잡지 않기 위해)
  const passwordHash = await argon2.hash(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
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
      return issueTokens(tx, account);
    });
  } catch (e) {
    // 동시 요청으로 사전 검사(findFirst)를 둘 다 통과한 경우, DB 유니크가 막아줌
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new HttpError(
        409,
        'ACCOUNT_ALREADY_EXISTS',
        '이미 가입된 이메일입니다.',
      );
    }
    throw e;
  }
}

export async function login(input: LoginInput) {
  if (input.provider !== 'BASIC') {
    throw new HttpError(
      501,
      'NOT_IMPLEMENTED',
      '소셜 로그인은 아직 지원하지 않습니다.',
    );
  }

  const email = input.provider_email.trim().toLowerCase();

  const found = await prisma.auth_providers.findFirst({
    where: { provider: Provider.BASIC, provider_email: email },
    select: {
      password_hash: true,
      auth_account: { select: { id: true, account_type: true } },
    },
  });

  // 계정이 없거나 비밀번호 해시가 없어도 반드시 검증을 한 번 수행 (응답 시간 동일화)
  const matched = await verifyPassword(
    found?.password_hash ?? DUMMY_HASH,
    input.password,
  );

  if (!found || !found.password_hash || !matched) {
    throw new HttpError(
      401,
      'INVALID_CREDENTIALS',
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    );
  }

  // 새 로그인 세션(family)의 시작: refresh token 행 저장 + 토큰 2개 발급
  return issueTokens(prisma, found.auth_account);
}
