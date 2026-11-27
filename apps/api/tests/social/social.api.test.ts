/**
 * SOCIAL QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - 실제 소셜 계정(TD-1)이 없어도 볼 수 있게 카카오·네이버·Google 응답을 가짜로 바꾼다 (tests/social-mock.ts)
 *   서버가 제공자 응답을 어떻게 다루는지를 본다. 실제 제공자 화면·키 설정은 L1·L2에서 본다
 * - BE-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 */
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder } from '../helpers.js';
import {
  mockSocial,
  type FakeSocialAccount,
  type SocialProvider,
} from '../social-mock.js';

const recorder = createRecorder('SOCIAL BE · AC');
const PROVIDERS: SocialProvider[] = ['KAKAO', 'NAVER', 'GOOGLE'];
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

let social: ReturnType<typeof mockSocial>;
const savedEnv: Record<string, string | undefined> = {};
const FAKE_KEYS = {
  KAKAO_REST_API_KEY: 'qa-kakao',
  NAVER_CLIENT_ID: 'qa-naver',
  NAVER_CLIENT_SECRET: 'qa-naver-secret',
  GOOGLE_CLIENT_ID: 'qa-google',
  GOOGLE_CLIENT_SECRET: 'qa-google-secret',
};

beforeAll(() => {
  // 제공자 키가 없으면 서버가 503으로 막으므로 가짜 키를 넣는다 (실제 요청은 social-mock이 가로챈다)
  for (const [key, value] of Object.entries(FAKE_KEYS)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  social = mockSocial();
});

afterAll(async () => {
  social.restore();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  recorder.print();
  await prisma.$disconnect();
});

let seq = 0;
/** 아직 스냅픽에 가입하지 않은 소셜 계정 (TD-1) */
const freshAccount = (
  override: Partial<FakeSocialAccount> = {},
): FakeSocialAccount => ({
  id: `${Date.now() % 1_000_000_000}${++seq}`,
  email: `qa-social-${randomBytes(4).toString('hex')}@example.com`,
  emailVerified: true,
  nickname: `QA별명${randomBytes(2).toString('hex')}`,
  ...override,
});

const socialBody = (provider: SocialProvider, account: FakeSocialAccount) => ({
  provider,
  code: social.give(provider, account),
  redirectUri: REDIRECT_URI,
  state: 'qa-state',
});

const socialSignup = (
  provider: SocialProvider,
  account: FakeSocialAccount,
  accountType = 'USER',
) =>
  api()
    .post('/auth/signup')
    .send({ ...socialBody(provider, account), accountType });
const socialLogin = (provider: SocialProvider, account: FakeSocialAccount) =>
  api().post('/auth/login').send(socialBody(provider, account));
const link = (
  token: string | null,
  provider: SocialProvider,
  account: FakeSocialAccount,
) => {
  const req = api().post('/auth/providers').send(socialBody(provider, account));
  return token ? req.set(bearer(token)) : req;
};

/** 이메일 가입 계정 */
async function emailAccount(
  email = `qa-basic-${randomBytes(4).toString('hex')}@example.com`,
) {
  const res = await api()
    .post('/auth/signup')
    .send({
      provider: 'BASIC',
      accountType: 'USER',
      nickname: `QA소셜_${randomBytes(3).toString('hex')}`,
      providerEmail: email,
      password: 'qaPass1!',
    });
  expect(res.status).toBe(201);
  return { email, accessToken: res.body.accessToken as string };
}

const me = async (accessToken: string) =>
  (await api().get('/users/me').set(bearer(accessToken))).body as {
    id: string;
    accountType: string;
    nickname: string;
  };

// ---------------------------------------------------------------------------
describe('SOCIAL BE · 가입 · 로그인 · 연결 요청 형식', () => {
  it.each([
    ['provider가 APPLE', { provider: 'APPLE' }],
    ['code가 빈 값', { code: '' }],
    ['redirectUri가 주소 형식 아님', { redirectUri: 'not-a-url' }],
  ])(
    'SOCIAL-BE-01 %s이면 가입·로그인 모두 400 VALIDATION_FAILED',
    async (_label, override) => {
      const body = { ...socialBody('KAKAO', freshAccount()), ...override };
      for (const res of [
        await api()
          .post('/auth/signup')
          .send({ ...body, accountType: 'USER' }),
        await api().post('/auth/login').send(body),
      ]) {
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_FAILED');
      }
    },
  );

  it('SOCIAL-BE-01b 연결(POST /auth/providers)도 같은 형식 오류면 400 VALIDATION_FAILED', async () => {
    const { accessToken } = await emailAccount();
    const res = await api()
      .post('/auth/providers')
      .set(bearer(accessToken))
      .send({ ...socialBody('KAKAO', freshAccount()), code: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
describe('SOCIAL BE · 가입 · 로그인', () => {
  it.each(PROVIDERS)(
    'SOCIAL-BE-R1 %s 가입 → 로그인하면 같은 계정 (L2-01·02·03)',
    async (provider) => {
      const account = freshAccount();
      const signedUp = await socialSignup(
        provider,
        account,
        provider === 'NAVER' ? 'PHOTOGRAPHER' : 'USER',
      );
      expect(signedUp.status).toBe(201);
      const signedUpMe = await me(signedUp.body.accessToken);
      expect(signedUpMe.accountType).toBe(
        provider === 'NAVER' ? 'PHOTOGRAPHER' : 'USER',
      );

      const loggedIn = await socialLogin(provider, account);
      expect(loggedIn.status).toBe(200);
      expect((await me(loggedIn.body.accessToken)).id).toBe(signedUpMe.id);
    },
  );

  it('SOCIAL-BE-R2 닉네임: 카카오·네이버는 별명, Google은 스냅픽_ 임시 닉네임, 별명이 겹치면 임시 닉네임 (L2-01, L2-15)', async () => {
    const kakao = freshAccount({
      nickname: `QA카카오${randomBytes(2).toString('hex')}`,
    });
    const kakaoMe = await me(
      (await socialSignup('KAKAO', kakao)).body.accessToken,
    );
    expect(kakaoMe.nickname).toBe(kakao.nickname);

    const google = await me(
      (await socialSignup('GOOGLE', freshAccount())).body.accessToken,
    );
    expect(google.nickname).toMatch(/^스냅픽_[0-9a-f]{12}$/);

    // 이미 쓰는 별명이면 가입은 되고 임시 닉네임이 들어간다
    const sameNickname = await me(
      (
        await socialSignup(
          'NAVER',
          freshAccount({ nickname: kakao.nickname ?? null }),
        )
      ).body.accessToken,
    );
    expect(sameNickname.nickname).toMatch(/^스냅픽_[0-9a-f]{12}$/);
  });

  it('SOCIAL-BE-02 가입하지 않은 소셜 계정으로 로그인하면 404 SOCIAL_ACCOUNT_NOT_FOUND (L2-04)', async () => {
    for (const provider of PROVIDERS) {
      const res = await socialLogin(provider, freshAccount());
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('SOCIAL_ACCOUNT_NOT_FOUND');
    }
  });

  it.each(['KAKAO', 'GOOGLE'] as const)(
    'SOCIAL-BE-03 %s: 이메일 동의가 없으면 400 SOCIAL_EMAIL_REQUIRED, 인증되지 않은 이메일이면 400 SOCIAL_EMAIL_NOT_VERIFIED',
    async (provider) => {
      const noEmail = await socialSignup(
        provider,
        freshAccount({ email: null }),
      );
      expect(noEmail.status).toBe(400);
      expect(noEmail.body.code).toBe('SOCIAL_EMAIL_REQUIRED');

      const unverified = await socialSignup(
        provider,
        freshAccount({ emailVerified: false }),
      );
      expect(unverified.status).toBe(400);
      expect(unverified.body.code).toBe('SOCIAL_EMAIL_NOT_VERIFIED');
    },
  );

  it('SOCIAL-BE-03b 네이버: 이메일 동의가 없으면 400 SOCIAL_EMAIL_REQUIRED (네이버는 인증 여부를 주지 않는다)', async () => {
    const res = await socialSignup('NAVER', freshAccount({ email: null }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SOCIAL_EMAIL_REQUIRED');
  });

  it('SOCIAL-BE-04 이미 가입한 이메일의 소셜 계정으로 가입하면 409 ACCOUNT_ALREADY_EXISTS, 새 계정 없음 (L2-06)', async () => {
    const { email } = await emailAccount();
    const before = await prisma.auth_accounts.count();
    const res = await socialSignup(
      'KAKAO',
      freshAccount({ email: email.toUpperCase() }),
    );
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACCOUNT_ALREADY_EXISTS');
    expect(await prisma.auth_accounts.count()).toBe(before);
  });

  it('SOCIAL-BE-R3 이미 가입한 소셜 계정으로 다시 가입하면 409 ACCOUNT_ALREADY_EXISTS (L2-05)', async () => {
    const account = freshAccount();
    await socialSignup('GOOGLE', account);
    const again = await socialSignup('GOOGLE', {
      ...account,
      email: `qa-other-${randomBytes(3).toString('hex')}@example.com`,
    });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ACCOUNT_ALREADY_EXISTS');
  });

  it('SOCIAL-BE-06 이미 쓴 인가 code로 다시 요청한 응답을 기록', async () => {
    const account = freshAccount();
    const body = socialBody('KAKAO', account);
    const first = await api()
      .post('/auth/signup')
      .send({ ...body, accountType: 'USER' });
    expect(first.status).toBe(201);
    const reused = await api().post('/auth/login').send(body);
    recorder.record('SOCIAL-BE-06', {
      status: reused.status,
      code: reused.body.code ?? null,
    });
  });
});

// ---------------------------------------------------------------------------
describe('SOCIAL BE · 계정 연결 POST /auth/providers', () => {
  it('SOCIAL-BE-R4 이메일 계정에 카카오를 연결하면 카카오로 로그인해도 같은 계정이다 (L2-08, L2-09)', async () => {
    const basic = await emailAccount();
    const kakao = freshAccount();
    const res = await link(basic.accessToken, 'KAKAO', kakao);
    expect(res.status).toBe(204);

    const loggedIn = await socialLogin('KAKAO', kakao);
    expect(loggedIn.status).toBe(200);
    expect((await me(loggedIn.body.accessToken)).id).toBe(
      (await me(basic.accessToken)).id,
    );

    const account = (
      await api().get('/auth/account').set(bearer(loggedIn.body.accessToken))
    ).body;
    recorder.record('SOCIAL-BE-R4', { '/auth/account': account });
  });

  it('SOCIAL-BE-05a 이미 연결된 방식이면 409 PROVIDER_ALREADY_LINKED', async () => {
    const basic = await emailAccount();
    await link(basic.accessToken, 'NAVER', freshAccount());
    const res = await link(basic.accessToken, 'NAVER', freshAccount());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PROVIDER_ALREADY_LINKED');
  });

  it('SOCIAL-BE-05b 다른 계정이 쓰는 소셜 계정이면 409 SOCIAL_ACCOUNT_IN_USE (L2-11)', async () => {
    const owner = await emailAccount();
    const google = freshAccount();
    await link(owner.accessToken, 'GOOGLE', google);
    const other = await emailAccount();
    const res = await link(other.accessToken, 'GOOGLE', {
      ...google,
      email: `qa-diff-${randomBytes(3).toString('hex')}@example.com`,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SOCIAL_ACCOUNT_IN_USE');
  });

  it('SOCIAL-BE-05c 그 소셜 이메일을 다른 계정이 쓰고 있으면 409 SOCIAL_ACCOUNT_IN_USE', async () => {
    const owner = await emailAccount();
    const other = await emailAccount();
    const res = await link(
      other.accessToken,
      'KAKAO',
      freshAccount({ email: owner.email }),
    );
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SOCIAL_ACCOUNT_IN_USE');
  });

  it('SOCIAL-BE-R5 연결할 때 이메일 제공에 동의하지 않으면 400 SOCIAL_EMAIL_REQUIRED (L2-16)', async () => {
    const basic = await emailAccount();
    const res = await link(
      basic.accessToken,
      'KAKAO',
      freshAccount({ email: null }),
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SOCIAL_EMAIL_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
describe('SOCIAL AC · 접근 제어', () => {
  it('SOCIAL-AC-01 비회원이 POST /auth/providers면 401 UNAUTHORIZED', async () => {
    const res = await link(null, 'KAKAO', freshAccount());
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
