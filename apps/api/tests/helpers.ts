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

/** 기록 값 한 칸을 사람이 읽기 좋게: 짧으면 한 줄, 길면 들여쓴 여러 줄 */
function formatValue(value: unknown, indent: string): string {
  if (value === null || typeof value !== 'object') {
    return String(value);
  }
  const oneLine = JSON.stringify(value);
  if (oneLine.length <= 60) {
    return oneLine;
  }
  return `\n${JSON.stringify(value, null, 2)
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n')}`;
}

/**
 * "기록한다" 체크 줄용: 판정 대신 본 값을 모아 테스트가 끝나면 출력한다
 * 긴 응답 본문도 줄이 깨지지 않게 항목마다 블록으로, 객체는 키마다 한 줄씩 출력한다
 *
 *   [기록] PROFILE BE · AC
 *   ▸ PROFILE-AC-03
 *       products: {"status":200,"count":1}
 *       reviews: {"status":200,"totalCount":0}
 */
export function createRecorder(title: string) {
  const rows: { id: string; value: unknown }[] = [];
  return {
    record(id: string, value: unknown) {
      rows.push({ id, value });
    },
    print() {
      if (rows.length === 0) {
        return;
      }
      const lines = [`\n[기록] ${title}`];
      for (const { id, value } of rows) {
        lines.push(`▸ ${id}`);
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          for (const [key, item] of Object.entries(value)) {
            lines.push(`    ${key}: ${formatValue(item, '      ')}`);
          }
        } else {
          lines.push(`    ${formatValue(value, '      ')}`);
        }
      }
      console.log(lines.join('\n'));
    },
  };
}
