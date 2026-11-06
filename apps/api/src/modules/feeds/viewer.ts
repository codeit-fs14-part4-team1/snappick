import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { AccessTokenPayload } from '../../utils/tokens.js';
import type { Viewer } from './feeds.service.js';

export const GUEST: Viewer = { userId: null, photographerId: null };

/**
 * 로그인 정보(req.auth)로 조회 계정의 프로필 ID를 찾는다
 * 일반 사용자는 userId, 작가는 photographerId만 채운다
 * 프로필이 없는 계정(탈퇴 등)은 비회원으로 본다
 */
export async function resolveViewer(
  auth: AccessTokenPayload | undefined,
): Promise<Viewer> {
  if (!auth) {
    return GUEST;
  }

  if (auth.accountType === 'USER') {
    const user = await prisma.users.findUnique({
      where: { auth_account_id: auth.accountId },
      select: { id: true },
    });
    return { userId: user?.id ?? null, photographerId: null };
  }

  const photographer = await prisma.photographers.findUnique({
    where: { auth_account_id: auth.accountId },
    select: { id: true },
  });
  return { userId: null, photographerId: photographer?.id ?? null };
}

// requireAccountType('PHOTOGRAPHER') 다음에 쓰므로 작가 프로필이 있어야 한다
export async function requirePhotographerId(
  auth: AccessTokenPayload,
): Promise<string> {
  const { photographerId } = await resolveViewer(auth);
  if (!photographerId) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }
  return photographerId;
}
