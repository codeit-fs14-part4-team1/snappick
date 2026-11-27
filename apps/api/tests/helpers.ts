import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { signAccessToken } from '../src/utils/tokens.js';

// 소켓 서버 대신 쓰는 빈 객체 (server.ts가 app.set('io')로 넣는 자리)
app.set('io', { to: () => ({ emit: () => true }) });

export const api = () => request(app);

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** 시드 계정으로 액세스 토큰을 만든다 (로그인 API를 거치지 않음) */
export async function tokenFor(accountId: string) {
  const account = await prisma.auth_accounts.findUniqueOrThrow({
    where: { id: accountId },
    select: { account_type: true },
  });
  return signAccessToken(accountId, account.account_type, 'BASIC');
}

/** 이미 만료된 토큰 */
export function expiredToken(accountId: string) {
  return jwt.sign(
    {
      sub: accountId,
      accountType: 'USER',
      provider: 'BASIC',
      exp: Math.floor(Date.now() / 1000) - 60,
    },
    process.env.JWT_ACCESS_SECRET ?? '',
  );
}

/**
 * "기록한다" 체크 줄용: 판정 대신 본 값을 모아 테스트가 끝나면 표로 출력한다
 */
export function createRecorder(title: string) {
  const rows: { id: string; 결과: string }[] = [];
  return {
    record(id: string, value: unknown) {
      rows.push({
        id,
        결과: typeof value === 'string' ? value : JSON.stringify(value),
      });
    },
    print() {
      if (rows.length > 0) {
        console.log(`\n[기록] ${title}`);
        console.table(rows);
      }
    },
  };
}
