import type { Prisma } from '../../generated/prisma/client.js';
import type { prisma } from '../../lib/prisma.js';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../../utils/tokens.js';

type Db = Prisma.TransactionClient | typeof prisma;

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
