import { z } from 'zod';

const isMissing = (value: unknown) => value === undefined || value === null;

// 닉네임 외의 키(profileImageUrl 등)는 거부한다
export const updateUserNicknameSchema = z.strictObject(
  {
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
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? '닉네임만 수정할 수 있어요.'
        : '요청 본문은 객체여야 합니다.',
  },
);

export type UpdateUserNicknameInput = z.infer<typeof updateUserNicknameSchema>;
