import { z } from 'zod';
import { AccountType } from '../../generated/prisma/enums.js';

// 값이 아예 없는 경우(키 누락 또는 null)를 구분하는 도우미
const isMissing = (value: unknown) => value === undefined || value === null;

const common = {
  account_type: z.enum(AccountType, {
    error: (issue) =>
      isMissing(issue.input)
        ? 'account_type은 필수 요소입니다.'
        : '지원하지 않는 account_type입니다.',
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

export const signupSchema = z.discriminatedUnion(
  'provider',
  [
    // BASIC: 이메일과 비밀번호 필수
    z.object({
      ...common,
      provider: z.literal('BASIC'),
      provider_email: z.email({
        error: (issue) =>
          isMissing(issue.input)
            ? 'Email은 필수 요소입니다.'
            : '올바른 이메일 형식이 아닙니다.',
      }),
      password: z
        .string({
          error: (issue) =>
            isMissing(issue.input)
              ? 'Password는 필수 요소입니다.'
              : 'Password는 문자열이어야 합니다.',
        })
        .min(8, '비밀번호는 8자 이상이어야 합니다.')
        .max(16, '비밀번호는 16자 이하여야 합니다.'),
    }),
    // 소셜: provider_token 필수
    z.object({
      ...common,
      provider: z.enum(['GOOGLE', 'KAKAO', 'NAVER']),
      provider_token: z
        .string({ error: '소셜 로그인이 정상적으로 수행되지 않았습니다.' })
        .min(1, '소셜 로그인이 정상적으로 수행되지 않았습니다.'),
    }),
  ],
  {
    // 어느 분기도 고를 수 없을 때(provider 누락/오류, body 이상)의 문구
    error: (issue) => {
      const input = issue.input as Record<string, unknown> | null | undefined;
      if (input === undefined || input === null || typeof input !== 'object') {
        return '요청 본문이 올바르지 않습니다.';
      }
      return isMissing(input.provider)
        ? 'provider는 필수 요소입니다.'
        : '지원하지 않는 provider입니다.';
    },
  },
);

export type SignupInput = z.infer<typeof signupSchema>;
