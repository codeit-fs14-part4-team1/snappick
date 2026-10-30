import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';

export async function getMe(accountId: string) {
  const account = await prisma.auth_accounts.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      account_type: true,
      created_at: true,
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
    account_type: account.account_type,
    nickname: profile.nickname,
    profile_image_url: profile.profile_image_url,
  };
}
