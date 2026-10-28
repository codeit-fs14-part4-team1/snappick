import { z } from 'zod';
import { AccountType } from '../../generated/prisma/enums.js';

const common = {
  account_type: z.enum(AccountType),
  nickname: z
    .string()
    .trim()
    .min(2, '닉네임은 2자 이상이어야 합니다.')
    .max(20, '닉네임은 20자 이하여야 합니다.'),
};

export const signupSchema = z.discriminatedUnion('provider', [
  // BASIC: 이메일과 비밀번호 필수
  z.object({
    ...common,
    provider: z.literal('BASIC'),
    provider_email: z.email({ error: 'Email은 필수 요소입니다.' }),
    password: z
      .string({ error: 'Password는 필수 요소입니다.' })
      .min(8, '비밀번호는 8자 이상이어야 합니다.')
      .max(16, '비밀번호는 16자 이하여야 합니다.'),
  }),
  // 소셜: provider_token 필수
  z.object({
    ...common,
    provider: z.enum(['GOOGLE', 'KAKAO', 'NAVER']),
    provider_token: z
      .string({ error: '소셜 로그인이 정상적으로 수행되지 않았습니다.' })
      .min(1),
  }),
]);

export type SignupInput = z.infer<typeof signupSchema>;
