import { z } from 'zod';
import { AccountType } from '../../generated/prisma/enums.js';

// 값이 아예 없는 경우(키 누락 또는 null)를 구분
const isMissing = (value: unknown) => value === undefined || value === null;

// 가입에서만 받는 필드
const common = {
  accountType: z.enum(AccountType, {
    error: (issue) =>
      isMissing(issue.input)
        ? 'accountType은 필수 요소입니다.'
        : '지원하지 않는 accountType입니다.',
  }),
  nickname: z
    .string({
      error: (issue) =>
        isMissing(issue.input)
          ? '닉네임은 필수 요소입니다.'
          : '닉네임은 문자열이어야 합니다.',
    })
    .trim()
    .min(2, '닉네임은 2자 이상이어야 합니다.')
    .max(20, '닉네임은 20자 이하여야 합니다.'),
};

// 가입·로그인이 공유하는 필드
const emailSchema = z.email({
  error: (issue) =>
    isMissing(issue.input)
      ? 'Email은 필수 요소입니다.'
      : '올바른 이메일 형식이 아닙니다.',
});

const passwordSchema = z
  .string({
    error: (issue) =>
      isMissing(issue.input)
        ? 'Password는 필수 요소입니다.'
        : 'Password는 문자열이어야 합니다.',
  })
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(16, '비밀번호는 16자 이하여야 합니다.');

const SOCIAL_AUTH_MESSAGE = '소셜 로그인이 정상적으로 수행되지 않았습니다.';
// 소셜 로그인 콜백으로 받은 인가 코드
const socialCodeSchema = z
  .string({ error: SOCIAL_AUTH_MESSAGE })
  .min(1, SOCIAL_AUTH_MESSAGE);
// 인가 코드를 요청할 때 쓴 redirect URI (제공자가 토큰을 교환할 때 같은 값인지 확인한다)
const redirectUriSchema = z.url({ error: SOCIAL_AUTH_MESSAGE });

// provider별 입력 필드 (가입은 여기에 common을 더해서 사용)
const basicFields = {
  provider: z.literal('BASIC'),
  providerEmail: emailSchema,
  password: passwordSchema,
};

const socialFields = {
  provider: z.enum(['GOOGLE', 'KAKAO', 'NAVER']),
  code: socialCodeSchema,
  redirectUri: redirectUriSchema,
};

// 어느 분기도 고를 수 없을 때(provider 누락/오류, body 이상)의 문구
const providerError = (issue: { input?: unknown }) => {
  const input = issue.input as Record<string, unknown> | null | undefined;
  if (input === undefined || input === null || typeof input !== 'object') {
    return '요청 본문이 올바르지 않습니다.';
  }
  return isMissing(input.provider)
    ? 'provider는 필수 요소입니다.'
    : '지원하지 않는 provider입니다.';
};

export const signupSchema = z.discriminatedUnion(
  'provider',
  [
    z.object({ ...common, ...basicFields }),
    // 소셜 가입의 닉네임은 제공자 프로필에서 가져온다
    z.object({ accountType: common.accountType, ...socialFields }),
  ],
  { error: providerError },
);

export const loginSchema = z.discriminatedUnion(
  'provider',
  [z.object(basicFields), z.object(socialFields)],
  { error: providerError },
);

// PATCH /auth/password
// 새 비밀번호는 가입과 같은 규칙, 현재 비밀번호는 값만 확인한다 (규칙이 바뀌기 전 비밀번호도 받기 위해)
export const changePasswordSchema = z.strictObject(
  {
    currentPassword: z
      .string({
        error: (issue) =>
          isMissing(issue.input)
            ? '현재 비밀번호는 필수 요소입니다.'
            : '현재 비밀번호는 문자열이어야 합니다.',
      })
      .min(1, '현재 비밀번호를 입력해 주세요.'),
    newPassword: passwordSchema,
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? '현재 비밀번호와 새 비밀번호만 보낼 수 있어요.'
        : '요청 본문은 객체여야 합니다.',
  },
);

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
