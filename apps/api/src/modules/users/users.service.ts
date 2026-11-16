import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { UpdateUserNicknameInput } from './users.schema.js';

export async function getMe(accountId: string) {
  const account = await prisma.auth_accounts.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      account_type: true,
      user: { select: { nickname: true, profile_image_url: true } },
      photographer: { select: { nickname: true, profile_image_url: true } },
    },
  });

  if (!account) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }

  const profile =
    account.account_type === 'PHOTOGRAPHER'
      ? account.photographer
      : account.user;

  if (!profile) {
    throw new HttpError(404, 'PROFILE_NOT_FOUND', '프로필을 찾을 수 없습니다.');
  }

  return {
    id: account.id,
    accountType: account.account_type,
    nickname: profile.nickname,
    profileImageUrl: profile.profile_image_url,
  };
}

export async function updateUserNickname(
  accountId: string,
  input: UpdateUserNicknameInput,
) {
  const result = await prisma.users.updateMany({
    where: { auth_account_id: accountId },
    data: {
      nickname: input.nickname,
    },
  });

  if (result.count === 0) {
    throw new HttpError(404, 'PROFILE_NOT_FOUND', '프로필을 찾지 못했습니다.');
  }

  // GET /users/me와 같은 형태로 돌려준다 (FE가 응답으로 user 상태를 바로 갱신)
  return getMe(accountId);
}
