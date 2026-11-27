/**
 * AUTH QA 체크리스트: BE 서버 규칙
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - AC 줄(로그인이 필요한 화면의 "로그인이 필요해요")은 화면 동작이라 여기서 보지 않는다
 * - refresh_token 쿠키는 응답의 Set-Cookie에서 꺼내 다음 요청에 직접 붙인다
 * - "10초가 지난 뒤"(BE-14)는 기다리지 않고 이전 토큰의 폐기 시각을 11초 전으로 옮겨 재현한다
 */
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { hashToken } from '../../src/utils/tokens.js';
import { api, bearer, createRecorder } from '../helpers.js';

const recorder = createRecorder('AUTH BE');

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

const PASSWORD = 'qaPass1!';
const uniqueEmail = (prefix = 'qa-auth') =>
  `${prefix}-${randomBytes(4).toString('hex')}@example.com`;
const uniqueNickname = () => `QA인증_${randomBytes(3).toString('hex')}`;

const signupBody = (override: Record<string, unknown> = {}) => ({
  provider: 'BASIC',
  accountType: 'USER',
  nickname: uniqueNickname(),
  providerEmail: uniqueEmail(),
  password: PASSWORD,
  ...override,
});

const signup = (body: Record<string, unknown>) =>
  api().post('/auth/signup').send(body);
const login = (providerEmail: string, password = PASSWORD) =>
  api()
    .post('/auth/login')
    .send({ provider: 'BASIC', providerEmail, password });
const refresh = (cookie?: string) => {
  const req = api().post('/auth/refresh');
  return cookie ? req.set('Cookie', `refresh_token=${cookie}`) : req;
};
const logout = (cookie?: string) => {
  const req = api().post('/auth/logout');
  return cookie ? req.set('Cookie', `refresh_token=${cookie}`) : req;
};

/** 응답의 Set-Cookie 중 refresh_token 줄 */
function refreshCookieLine(res: {
  headers: Record<string, unknown>;
}): string | undefined {
  const raw = res.headers['set-cookie'];
  const lines = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  return lines.find((line) => line.startsWith('refresh_token='));
}
/** refresh_token 쿠키 값 (없으면 undefined) */
const refreshCookie = (res: { headers: Record<string, unknown> }) =>
  refreshCookieLine(res)?.split(';')[0]?.slice('refresh_token='.length) ||
  undefined;

/** 새 계정으로 가입하고 이메일·쿠키·토큰을 돌려준다 */
async function newAccount(override: Record<string, unknown> = {}) {
  const body = signupBody(override);
  const res = await signup(body);
  expect(res.status).toBe(201);
  return {
    email: body.providerEmail as string,
    nickname: body.nickname as string,
    accessToken: res.body.accessToken as string,
    cookie: refreshCookie(res)!,
  };
}

// ---------------------------------------------------------------------------
describe('AUTH BE · 가입 POST /auth/signup', () => {
  it('AUTH-BE-01 정상 요청이면 201과 accessToken, refresh_token 쿠키가 HttpOnly·Path /auth', async () => {
    const res = await signup(signupBody());
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const line = refreshCookieLine(res)!;
    expect(line).toBeDefined();
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/Path=\/auth(;|$)/);
  });

  it.each([
    ['USER', 'USER'],
    ['PHOTOGRAPHER', 'PHOTOGRAPHER'],
  ])(
    'AUTH-BE-R1 %s로 가입하면 바로 로그인되고 /users/me가 그 계정으로 온다 (L2-01, L2-02)',
    async (accountType) => {
      const account = await newAccount({ accountType });
      const me = await api().get('/users/me').set(bearer(account.accessToken));
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({
        accountType,
        nickname: account.nickname,
      });
    },
  );

  it('AUTH-BE-02 이미 있는 이메일이면 대소문자가 달라도 409 ACCOUNT_ALREADY_EXISTS', async () => {
    const account = await newAccount();
    const res = await signup(
      signupBody({ providerEmail: account.email.toUpperCase() }),
    );
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACCOUNT_ALREADY_EXISTS');
  });

  it('AUTH-BE-R2 같은 이메일로 동시에 가입하면 한쪽만 가입되고 다른 쪽은 409 (L2-11)', async () => {
    const email = uniqueEmail('qa-race');
    const results = await Promise.all([
      signup(signupBody({ providerEmail: email })),
      signup(signupBody({ providerEmail: email })),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(results.find(({ status }) => status === 409)?.body.code).toBe(
      'ACCOUNT_ALREADY_EXISTS',
    );
    expect(
      await prisma.auth_providers.count({
        where: { provider: 'BASIC', provider_email: email },
      }),
    ).toBe(1);
  });

  it.each([
    ['7자', 'qaPas1!'],
    ['17자', 'qaPassword12345!!'],
  ])(
    'AUTH-BE-03 비밀번호 %s면 400 VALIDATION_FAILED',
    async (_label, password) => {
      const res = await signup(signupBody({ password }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it('AUTH-BE-03b 비밀번호 8자·16자는 받는다', async () => {
    for (const password of ['qaPass1!', 'qaPassword1234!!']) {
      expect((await signup(signupBody({ password }))).status).toBe(201);
    }
  });

  it('AUTH-BE-04 숫자만 8자인 비밀번호로 가입한 응답을 기록', async () => {
    const res = await signup(signupBody({ password: '12345678' }));
    recorder.record('AUTH-BE-04', {
      status: res.status,
      code: res.body.code ?? null,
    });
  });

  it.each([
    ['형식이 틀림', { providerEmail: 'not-an-email' }],
    ['빠짐', { providerEmail: undefined }],
  ])(
    'AUTH-BE-05 이메일이 %s이면 400 VALIDATION_FAILED',
    async (_label, override) => {
      const res = await signup(signupBody(override));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it.each([
    ['빠짐', { accountType: undefined }],
    ['ADMIN', { accountType: 'ADMIN' }],
  ])(
    'AUTH-BE-06 accountType이 %s이면 400 VALIDATION_FAILED',
    async (_label, override) => {
      const res = await signup(signupBody(override));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it.each([
    ['1자', '가'],
    ['21자', '가'.repeat(21)],
  ])(
    'AUTH-BE-07 닉네임 %s면 400 VALIDATION_FAILED',
    async (_label, nickname) => {
      const res = await signup(signupBody({ nickname }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it('AUTH-BE-08 provider가 빠지면 400 VALIDATION_FAILED, 깨진 JSON이면 400 INVALID_JSON', async () => {
    const missing = await signup(signupBody({ provider: undefined }));
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('VALIDATION_FAILED');

    const broken = await api()
      .post('/auth/signup')
      .set('Content-Type', 'application/json')
      .send('{"provider": "BASIC",');
    expect(broken.status).toBe(400);
    expect(broken.body.code).toBe('INVALID_JSON');
  });
});

// ---------------------------------------------------------------------------
describe('AUTH BE · 로그인 POST /auth/login', () => {
  it('AUTH-BE-09 정상 요청이면 200과 accessToken, refresh_token 쿠키 (L2-03)', async () => {
    const account = await newAccount();
    const res = await login(account.email);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toBeDefined();
    const me = await api().get('/users/me').set(bearer(res.body.accessToken));
    expect(me.body.nickname).toBe(account.nickname);
  });

  it('AUTH-BE-10 비밀번호가 틀리거나 없는 이메일이면 둘 다 401 INVALID_CREDENTIALS, 같은 메시지', async () => {
    const account = await newAccount();
    const wrongPassword = await login(account.email, 'wrongPass1!');
    const unknownEmail = await login(uniqueEmail('qa-none'));
    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    }
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('AUTH-BE-R3 대문자 섞인 이메일로 가입한 뒤 소문자로 로그인된다 (L2-04)', async () => {
    const email = `QA-Mixed-${randomBytes(3).toString('hex')}@Example.com`;
    await newAccount({ providerEmail: email });
    expect((await login(email.toLowerCase())).status).toBe(200);
  });

  // L2-05는 화면 줄이고, 화면은 공백을 지우고 보내 통과한다 (LoginForm의 email.trim())
  // 서버는 공백을 지우기 전에 이메일 형식을 검사하므로 API로 직접 보낸 경우를 기록만 한다
  it('AUTH-BE-R4 이메일 앞뒤에 공백을 넣어 API로 직접 로그인한 응답을 기록 (L2-05 서버 쪽)', async () => {
    const account = await newAccount();
    const res = await login(`  ${account.email}  `);
    recorder.record('AUTH-BE-R4', {
      status: res.status,
      code: res.body.code ?? null,
    });
  });
});

// ---------------------------------------------------------------------------
describe('AUTH BE · 토큰 갱신 · 로그아웃', () => {
  it('AUTH-BE-11 쿠키 없이 갱신하면 401 INVALID_REFRESH_TOKEN', async () => {
    const res = await refresh();
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('AUTH-BE-12 정상 쿠키로 갱신하면 200과 새 accessToken, 쿠키가 새 값으로 바뀐다', async () => {
    const account = await newAccount();
    const res = await refresh(account.cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const next = refreshCookie(res);
    expect(next).toBeDefined();
    expect(next).not.toBe(account.cookie);
  });

  it('AUTH-BE-13 바뀌기 전 쿠키로 10초 안에 다시 갱신하면 200, 쿠키는 바뀌지 않는다', async () => {
    const account = await newAccount();
    await refresh(account.cookie);
    const again = await refresh(account.cookie);
    expect(again.status).toBe(200);
    expect(again.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(again)).toBeUndefined();
  });

  it('AUTH-BE-14 바뀌기 전 쿠키로 10초가 지난 뒤 갱신하면 401, 그 뒤로는 최신 쿠키로도 401', async () => {
    const account = await newAccount();
    const latest = refreshCookie(await refresh(account.cookie))!;
    // 이전 토큰이 11초 전에 바뀐 것으로 옮긴다
    await prisma.auth_refresh_tokens.update({
      where: { token_hash: hashToken(account.cookie) },
      data: { revoked_at: new Date(Date.now() - 11_000) },
    });

    const reused = await refresh(account.cookie);
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe('INVALID_REFRESH_TOKEN');
    expect((await refresh(latest)).status).toBe(401);
  });

  it('AUTH-BE-R5 여러 탭이 같은 쿠키로 동시에 갱신해도 모두 200 (L2-14)', async () => {
    const account = await newAccount();
    const results = await Promise.all(
      [1, 2, 3].map(() => refresh(account.cookie)),
    );
    results.forEach(({ status }) => expect(status).toBe(200));
    // 새 쿠키는 한 번만 발급된다
    expect(
      results.filter((res) => refreshCookie(res) !== undefined),
    ).toHaveLength(1);
  });

  it('AUTH-BE-15 로그아웃하면 204, 쿠키가 지워지고 지우기 전 쿠키로 갱신하면 401', async () => {
    const account = await newAccount();
    const res = await logout(account.cookie);
    expect(res.status).toBe(204);
    const line = refreshCookieLine(res)!;
    expect(line).toMatch(/^refresh_token=;/);
    expect(line).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await refresh(account.cookie)).status).toBe(401);
  });

  it('AUTH-BE-16 쿠키 없이 로그아웃해도 204', async () => {
    expect((await logout()).status).toBe(204);
  });

  it('AUTH-BE-17 Authorization 없이, 또는 망가진 토큰으로 GET /users/me면 401 UNAUTHORIZED', async () => {
    for (const res of [
      await api().get('/users/me'),
      await api().get('/users/me').set(bearer('broken.token')),
      await api().get('/users/me').set('Authorization', 'Token abc'),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });
});
