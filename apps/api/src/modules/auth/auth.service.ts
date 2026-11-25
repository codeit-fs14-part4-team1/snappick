import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import {
  isNicknameConflict,
  nicknameAlreadyExists,
} from '../../utils/nickname.js';
import type { AccessTokenPayload } from '../../utils/tokens.js';
import type {
  ChangePasswordInput,
  SignupInput,
  LoginInput,
  LinkProviderInput,
} from './auth.schema.js';
import { issueTokens, revokeOtherSessions } from './token.service.js';
import {
  getSocialProfile,
  type SocialProfile,
  type SocialProvider,
} from './oauth.service.js';
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

const accountAlreadyExists = () =>
  new HttpError(409, 'ACCOUNT_ALREADY_EXISTS', '이미 가입된 이메일입니다.');

const providerAlreadyLinked = () =>
  new HttpError(
    409,
    'PROVIDER_ALREADY_LINKED',
    '이미 연동된 로그인 방식이에요.',
  );

const socialAccountInUse = () =>
  new HttpError(
    409,
    'SOCIAL_ACCOUNT_IN_USE',
    '다른 계정에서 사용 중인 소셜 계정이에요.',
  );

type SocialSignupInput = Extract<SignupInput, { provider: SocialProvider }>;
type SocialLoginInput = Extract<LoginInput, { provider: SocialProvider }>;

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

// 이메일 가입(FE)과 같은 형식의 임시 닉네임
const temporaryNickname = () =>
  `스냅픽_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

/**
 * 제공자 닉네임을 우리 닉네임 규칙(앞뒤 공백 제거 후 2~20자)에 맞춘다
 * 길이는 가입·수정 검증(zod .max)과 같은 기준(string.length)으로 센다. 이모지는 2로 세어진다
 * 길면 20까지 자르되 이모지 중간에서 끊지 않는다
 * 닉네임이 없거나(동의 안 함, 별명 미설정 등) 2 미만이면 이메일 가입과 같은 형식의 임시 닉네임을 쓴다
 * 닉네임은 가입 후 마이페이지에서 바꿀 수 있다
 */
function toNickname(nickname: string | null): string {
  let result = '';
  for (const char of (nickname ?? '').trim()) {
    if (result.length + char.length > NICKNAME_MAX) break;
    result += char;
  }
  result = result.trim();
  if (result.length >= NICKNAME_MIN) {
    return result;
  }
  return temporaryNickname();
}

export async function signup(input: SignupInput) {
  if (input.provider !== 'BASIC') {
    return socialSignup(input);
  }

  const email = input.providerEmail.trim().toLowerCase();

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
    // 계정/provider/프로필/토큰을 모두 한 트랜잭션으로 묶음
    return await prisma.$transaction(async (tx) => {
      const account = await tx.auth_accounts.create({
        data: {
          account_type: input.accountType,
          nickname: input.nickname,
          auth_provider: {
            create: {
              provider: 'BASIC',
              provider_email: email,
              password_hash: passwordHash,
            },
          },
          ...(input.accountType === 'USER'
            ? { user: { create: {} } }
            : { photographer: { create: {} } }),
        },
        select: { id: true, account_type: true },
      });

      // 새 로그인 세션(family)의 시작: refresh token 행 저장 + 토큰 2개 발급
      return issueTokens(tx, account, Provider.BASIC);
    });
  } catch (e) {
    if (isNicknameConflict(e)) throw nicknameAlreadyExists();
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

/**
 * 가입·연동에 쓸 수 있는 인증된 이메일을 꺼낸다 (없으면 400)
 */
function getVerifiedEmail(profile: SocialProfile, action: '가입' | '연동') {
  if (!profile.email) {
    throw new HttpError(
      400,
      'SOCIAL_EMAIL_REQUIRED',
      `이메일 제공에 동의해야 ${action}할 수 있어요.`,
    );
  }
  // 인증되지 않은 이메일로 다른 사람의 이메일을 선점하지 못하게 한다
  if (!profile.emailVerified) {
    throw new HttpError(
      400,
      'SOCIAL_EMAIL_NOT_VERIFIED',
      `인증된 이메일이 있는 계정만 ${action}할 수 있어요.`,
    );
  }
  return profile.email;
}

/**
 * 소셜 가입 (POST /auth/signup, provider: KAKAO 등)
 * 콜백에서 받은 인가 코드로 제공자 프로필을 가져오고, 인증된 이메일이 있을 때만 가입시킨다
 * 이메일은 선택 동의라 없을 수 있다 → 400으로 동의를 다시 받게 한다
 * 닉네임은 제공자 프로필의 닉네임을 쓰고, 없거나 이미 사용 중이면 임시 닉네임을 쓴다 (모든 제공자 공통)
 * 같은 이메일의 계정이 이미 있으면 BASIC 가입과 같이 409 (기존 계정으로 로그인 후 연동하도록 유도)
 */
async function socialSignup(input: SocialSignupInput) {
  const profile = await getSocialProfile(input.provider, input);
  const nickname = toNickname(profile.nickname);
  const email = getVerifiedEmail(profile, '가입');

  const existing = await prisma.auth_providers.findFirst({
    where: {
      OR: [
        { provider: input.provider, provider_user_id: profile.providerUserId },
        { provider_email: email },
      ],
    },
    select: { id: true },
  });
  if (existing) throw accountAlreadyExists();

  const create = (accountNickname: string) =>
    prisma.$transaction(async (tx) => {
      const account = await tx.auth_accounts.create({
        data: {
          account_type: input.accountType,
          nickname: accountNickname,
          auth_provider: {
            create: {
              provider: input.provider,
              provider_email: email,
              provider_user_id: profile.providerUserId,
            },
          },
          ...(input.accountType === 'USER'
            ? { user: { create: {} } }
            : { photographer: { create: {} } }),
        },
        select: { id: true, account_type: true },
      });

      return issueTokens(tx, account, input.provider);
    });

  try {
    try {
      return await create(nickname);
    } catch (e) {
      // 제공자 닉네임은 본인이 고른 값이 아니므로, 겹쳐도 가입을 막지 않는다
      if (!isNicknameConflict(e)) throw e;
      return await create(temporaryNickname());
    }
  } catch (e) {
    // 같은 소셜 계정으로 동시에 가입한 경우 DB 유니크가 막아준다
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw accountAlreadyExists();
    }
    throw e;
  }
}

/**
 * 소셜 로그인 (POST /auth/login, provider: KAKAO 등)
 * 제공자의 사용자 ID로 연결된 계정을 찾는다. 이메일은 확인하지 않는다 (가입 후 동의를 철회했을 수 있음)
 * 연결된 계정이 없으면 404 → FE는 가입 화면(계정 종류 선택)으로 보낸다
 * 인가 코드는 한 번만 쓸 수 있어 가입은 카카오 로그인을 다시 거쳐 새 코드로 한다
 */
async function socialLogin(input: SocialLoginInput) {
  const profile = await getSocialProfile(input.provider, input);

  const found = await prisma.auth_providers.findUnique({
    where: {
      provider_provider_user_id: {
        provider: input.provider,
        provider_user_id: profile.providerUserId,
      },
    },
    select: { auth_account: { select: { id: true, account_type: true } } },
  });
  if (!found) {
    throw new HttpError(
      404,
      'SOCIAL_ACCOUNT_NOT_FOUND',
      '가입되지 않은 계정입니다. 회원가입을 진행해 주세요.',
    );
  }

  return issueTokens(prisma, found.auth_account, input.provider);
}

/**
 * 소셜 계정 연동 (POST /auth/providers)
 * 로그인한 계정에 소셜 로그인 방식을 추가한다. 토큰은 새로 발급하지 않는다
 * 소셜 이메일은 계정 이메일과 달라도 되지만, 다른 계정이 쓰는 이메일이면 409
 */
export async function linkProvider(
  accountId: string,
  input: LinkProviderInput,
) {
  const { provider } = input;

  // 이미 연동했다면 제공자에 요청하지 않는다
  const linked = await prisma.auth_providers.findMany({
    where: { auth_account_id: accountId },
    select: { provider: true },
  });
  if (linked.length === 0) {
    throw new HttpError(404, 'ACCOUNT_NOT_FOUND', '계정을 찾을 수 없습니다.');
  }
  if (linked.some((row) => row.provider === provider)) {
    throw providerAlreadyLinked();
  }

  const profile = await getSocialProfile(provider, input);
  const email = getVerifiedEmail(profile, '연동');

  // 다른 계정이 이 소셜 계정이나 이메일을 쓰고 있는지 확인
  // 내 계정의 이메일과 같은 것은 정상이므로 제외한다
  const usedByOther = await prisma.auth_providers.findFirst({
    where: {
      auth_account_id: { not: accountId },
      OR: [
        { provider, provider_user_id: profile.providerUserId },
        { provider_email: email },
      ],
    },
    select: { id: true },
  });
  if (usedByOther) throw socialAccountInUse();

  try {
    await prisma.auth_providers.create({
      data: {
        auth_account_id: accountId,
        provider,
        provider_email: email,
        provider_user_id: profile.providerUserId,
      },
    });
  } catch (e) {
    // 동시 요청으로 사전 검사를 통과한 경우 DB 유니크가 막아준다
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      // 같은 요청을 두 번 보낸 것인지, 다른 계정이 먼저 연동한 것인지 구분
      const mine = await prisma.auth_providers.findUnique({
        where: {
          auth_account_id_provider: { auth_account_id: accountId, provider },
        },
        select: { id: true },
      });
      throw mine ? providerAlreadyLinked() : socialAccountInUse();
    }
    throw e;
  }
}

export async function login(input: LoginInput) {
  if (input.provider !== 'BASIC') {
    return socialLogin(input);
  }

  const email = input.providerEmail.trim().toLowerCase();

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
  return issueTokens(prisma, found.auth_account, Provider.BASIC);
}

/**
 * 내 계정 정보 (GET /auth/account)
 * provider: 이번 로그인 세션의 로그인 방식 (access token에 담긴 값)
 * email: 이번 로그인 방식의 이메일 (카카오로 로그인했으면 카카오 이메일)
 *   비밀번호 변경 가능 여부는 email이 아니라 provider === 'BASIC'으로 판단한다
 * providers: 이 계정에 연결된 로그인 방식 전체 (연결한 순서)
 */
export async function getAccount(auth: AccessTokenPayload) {
  const providers = await prisma.auth_providers.findMany({
    where: { auth_account_id: auth.accountId },
    // password_hash는 가져오지 않는다
    select: { provider: true, provider_email: true },
    orderBy: { created_at: 'asc' },
  });

  if (providers.length === 0) {
    throw new HttpError(404, 'ACCOUNT_NOT_FOUND', '계정을 찾을 수 없습니다.');
  }

  const current = providers.find((row) => row.provider === auth.provider);

  return {
    provider: auth.provider,
    // 세션의 로그인 방식이 그 뒤 연결 해제됐다면 행이 없을 수 있다
    email: current?.provider_email ?? null,
    providers: providers.map((row) => ({
      provider: row.provider,
      email: row.provider_email,
    })),
  };
}

/**
 * 닉네임 사용 가능 여부 (GET /auth/nickname/availability)
 * 유저·작가 전체에서 대소문자 구분 없이 비교한다. 로그인했다면 내 닉네임은 사용 가능으로 본다
 * 확인한 뒤 다른 사람이 먼저 쓸 수 있으므로, 저장할 때의 409(NICKNAME_ALREADY_EXISTS)도 처리해야 한다
 */
export async function checkNickname(
  nickname: string,
  accountId: string | undefined,
) {
  // insensitive 검색은 ILIKE라 닉네임의 _와 %가 와일드카드가 된다. 유니크 인덱스와 같은 lower()로 비교한다
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM auth_accounts
    WHERE lower(nickname) = lower(${nickname})
  `;

  return { available: rows.every(({ id }) => id === accountId) };
}

/**
 * 비밀번호 변경 (PATCH /auth/password)
 * 이번 로그인을 이메일(BASIC)로 했을 때만 바꿀 수 있다 (소셜 로그인 세션은 403)
 * 바꾸면 지금 세션을 뺀 다른 로그인 세션(다른 기기·브라우저)은 모두 로그아웃시킨다
 * currentRefreshToken: 지금 세션의 refresh token 쿠키 (없으면 모든 세션을 로그아웃)
 */
export async function changePassword(
  auth: AccessTokenPayload,
  input: ChangePasswordInput,
  currentRefreshToken: string | undefined,
) {
  if (auth.provider !== Provider.BASIC) {
    throw new HttpError(
      403,
      'PASSWORD_CHANGE_NOT_ALLOWED',
      '소셜 로그인 중에는 비밀번호를 변경할 수 없어요.',
    );
  }

  const basic = await prisma.auth_providers.findUnique({
    where: {
      auth_account_id_provider: {
        auth_account_id: auth.accountId,
        provider: Provider.BASIC,
      },
    },
    select: { id: true, password_hash: true },
  });
  if (!basic?.password_hash) {
    throw new HttpError(
      409,
      'PASSWORD_NOT_SET',
      '비밀번호가 설정되지 않은 계정이에요.',
    );
  }

  // 401은 FE가 토큰 만료로 보고 refresh·로그아웃을 하므로, 비밀번호 불일치는 400으로 돌려준다
  if (!(await verifyPassword(basic.password_hash, input.currentPassword))) {
    throw new HttpError(
      400,
      'INVALID_CURRENT_PASSWORD',
      '현재 비밀번호가 일치하지 않아요.',
    );
  }
  if (input.newPassword === input.currentPassword) {
    throw new HttpError(
      400,
      'SAME_AS_CURRENT_PASSWORD',
      '지금과 다른 비밀번호를 입력해 주세요.',
    );
  }

  const passwordHash = await argon2.hash(input.newPassword);
  await prisma.auth_providers.update({
    where: { id: basic.id },
    data: { password_hash: passwordHash },
  });

  await revokeOtherSessions(auth.accountId, currentRefreshToken);
}
