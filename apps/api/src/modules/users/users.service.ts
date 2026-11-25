import { prisma } from '../../lib/prisma.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { HttpError } from '../../utils/http-error.js';
import {
  isNicknameConflict,
  nicknameAlreadyExists,
} from '../../utils/nickname.js';
import type { UpdateUserNicknameInput } from './users.schema.js';

export async function getMe(accountId: string) {
  const account = await prisma.auth_accounts.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      account_type: true,
      nickname: true,
      user: { select: { profile_image_url: true } },
      photographer: { select: { profile_image_url: true } },
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
    nickname: account.nickname,
    // DB에는 저장 경로만 있으므로 응답용 전체 주소로 바꾼다
    profileImageUrl: toImageUrl(profile.profile_image_url),
  };
}

export async function updateUserNickname(
  accountId: string,
  input: UpdateUserNicknameInput,
) {
  const result = await prisma.auth_accounts
    .updateMany({
      where: { id: accountId, user: { isNot: null } },
      data: {
        nickname: input.nickname,
      },
    })
    .catch((error: unknown) => {
      throw isNicknameConflict(error) ? nicknameAlreadyExists() : error;
    });

  if (result.count === 0) {
    throw new HttpError(404, 'PROFILE_NOT_FOUND', '프로필을 찾지 못했습니다.');
  }

  // GET /users/me와 같은 형태로 돌려준다 (FE가 응답으로 user 상태를 바로 갱신)
  return getMe(accountId);
}
