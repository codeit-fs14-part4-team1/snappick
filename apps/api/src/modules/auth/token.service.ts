import type { Prisma } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../../utils/tokens.js';

type Db = Prisma.TransactionClient | typeof prisma;

const DAY_MS = 24 * 60 * 60 * 1000;

// 동시 요청(여러 탭 등)으로 방금 폐기된 토큰이 한 번 더 들어오는 경우를 정상으로 보는 시간
const REUSE_GRACE_MS = 10 * 1000;

// 쿠키 없음, 없는 토큰, 폐기, 만료를 모두 같은 응답으로 통일
const invalidRefreshToken = () =>
  new HttpError(
    401,
    'INVALID_REFRESH_TOKEN',
    '유효하지 않은 refresh token입니다.',
  );

export async function issueTokens(
  db: Db,
  account: { id: string; account_type: string },
  familyId?: string,
) {
  const refreshToken = generateRefreshToken();

  const row = await db.auth_refresh_tokens.create({
    data: {
      auth_account_id: account.id,
      token_hash: hashToken(refreshToken),
      ...(familyId ? { family_id: familyId } : {}),
    },
    select: { id: true },
  });

  return {
    accessToken: signAccessToken(account.id, account.account_type),
    refreshToken,
    refreshTokenId: row.id,
  };
}

// 한 로그인 세션(family)의 토큰을 모두 폐기 (재사용 감지, 로그아웃에서 사용)
export async function revokeFamily(familyId: string) {
  await prisma.auth_refresh_tokens.updateMany({
    where: { family_id: familyId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

type RotateResult = {
  accessToken: string;
  // 유예 구간에서 access token만 새로 받는 경우에는 null (쿠키는 이미 새 값으로 바뀌어 있음)
  refreshToken: string | null;
};

export async function revokeSession(rawToken: string) {
  const row = await prisma.auth_refresh_tokens.findUnique({
    where: { token_hash: hashToken(rawToken) },
    select: { family_id: true },
  });
  if (row) await revokeFamily(row.family_id);
}

export async function rotateRefreshToken(
  rawToken: string,
): Promise<RotateResult> {
  const current = await prisma.auth_refresh_tokens.findUnique({
    where: { token_hash: hashToken(rawToken) },
    select: {
      id: true,
      family_id: true,
      revoked_at: true,
      replaced_by_id: true,
      created_at: true,
      auth_account: { select: { id: true, account_type: true } },
    },
  });
  if (!current) throw invalidRefreshToken();

  if (
    Date.now() - current.created_at.getTime() >
    env.refreshTokenTtlDays * DAY_MS
  ) {
    throw invalidRefreshToken();
  }

  // 이미 폐기된 토큰이 다시 들어온 경우
  if (current.revoked_at) {
    return handleRevoked(
      { revokedAt: current.revoked_at, replacedById: current.replaced_by_id },
      current,
    );
  }

  // 아직 폐기되지 않은 행만 선점 (같은 토큰으로 동시에 들어온 요청 중 하나만 성공)
  const rotated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.auth_refresh_tokens.updateMany({
      where: { id: current.id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    if (claimed.count === 0) return null;

    const issued = await issueTokens(
      tx,
      current.auth_account,
      current.family_id,
    );
    await tx.auth_refresh_tokens.update({
      where: { id: current.id },
      data: { replaced_by_id: issued.refreshTokenId },
    });
    return issued;
  });

  if (rotated) {
    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    };
  }

  // 선점에 실패 = 다른 요청이 방금 먼저 처리함 → 폐기 시각을 다시 읽어 같은 규칙으로 판단
  const latest = await prisma.auth_refresh_tokens.findUnique({
    where: { id: current.id },
    select: { revoked_at: true, replaced_by_id: true },
  });
  return handleRevoked(
    {
      revokedAt: latest?.revoked_at ?? new Date(0),
      replacedById: latest?.replaced_by_id ?? null,
    },
    current,
  );
}

async function handleRevoked(
  revoked: { revokedAt: Date; replacedById: string | null },
  current: {
    family_id: string;
    auth_account: { id: string; account_type: string };
  },
): Promise<RotateResult> {
  // 세션(family)에 아직 폐기되지 않은 토큰이 있을 때만 유예 적용
  // (회전은 항상 살아 있는 최신 토큰을 남기고, 로그아웃·재사용 감지는 세션의 모든 토큰을 폐기함)
  if (
    revoked.replacedById !== null &&
    Date.now() - revoked.revokedAt.getTime() <= REUSE_GRACE_MS
  ) {
    const alive = await prisma.auth_refresh_tokens.count({
      where: { family_id: current.family_id, revoked_at: null },
    });
    if (alive > 0) {
      return {
        accessToken: signAccessToken(
          current.auth_account.id,
          current.auth_account.account_type,
        ),
        refreshToken: null,
      };
    }
  }

  // 오래전에 폐기된 토큰의 재사용: 탈취로 보고 같은 로그인 세션의 토큰을 모두 폐기
  await revokeFamily(current.family_id);
  throw invalidRefreshToken();
}
