/**
 * MYPAGE QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - 소셜로 로그인한 상태(TD-2·3)는 로그인 방식을 KAKAO로 넣은 토큰을 직접 발급해 만든다
 * - refresh_token 쿠키는 응답의 Set-Cookie에서 꺼내 직접 붙인다 (path가 /auth라 /auth/password에도 붙는다)
 */
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { api, bearer, createRecorder } from '../helpers.js';
import { createPhotographerAccount } from '../fixtures.js';

const recorder = createRecorder('MYPAGE BE · AC');

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

const PASSWORD = 'qaPass1!';
const NEW_PASSWORD = 'qaNewPass2@';

const refreshCookie = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers['set-cookie'];
  const lines = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  return lines
    .find((line) => line.startsWith('refresh_token='))
    ?.split(';')[0]
    ?.slice('refresh_token='.length);
};

/** 이메일로 가입한 일반 계정 (가입 세션의 토큰·쿠키 포함) */
async function emailUser(accountType: 'USER' | 'PHOTOGRAPHER' = 'USER') {
  const email = `qa-my-${randomBytes(4).toString('hex')}@example.com`;
  const nickname = `QA마이_${randomBytes(3).toString('hex')}`;
  const res = await api().post('/auth/signup').send({
    provider: 'BASIC',
    accountType,
    nickname,
    providerEmail: email,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  const account = await prisma.auth_providers.findFirstOrThrow({
    where: { provider: 'BASIC', provider_email: email },
    select: { auth_account_id: true },
  });
  return {
    email,
    nickname,
    accountId: account.auth_account_id,
    accessToken: res.body.accessToken as string,
    cookie: refreshCookie(res)!,
  };
}

const login = (email: string, password: string) =>
  api()
    .post('/auth/login')
    .send({ provider: 'BASIC', providerEmail: email, password });
const changePassword = (
  accessToken: string | null,
  body: Record<string, unknown>,
  cookie?: string,
) => {
  const req = api().patch('/auth/password').send(body);
  if (accessToken) req.set(bearer(accessToken));
  if (cookie) req.set('Cookie', `refresh_token=${cookie}`);
  return req;
};
const changeNickname = (
  accessToken: string | null,
  body: Record<string, unknown>,
) => {
  const req = api().patch('/users/me').send(body);
  return accessToken ? req.set(bearer(accessToken)) : req;
};
const refresh = (cookie: string) =>
  api().post('/auth/refresh').set('Cookie', `refresh_token=${cookie}`);

// ---------------------------------------------------------------------------
describe('MYPAGE BE · 내 정보 GET /auth/account', () => {
  it('MYPAGE-BE-01 지금 로그인한 방식·이메일·연결된 방식 목록이 오고, Cache-Control: no-store', async () => {
    const user = await emailUser();
    const res = await api().get('/auth/account').set(bearer(user.accessToken));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body).toEqual({
      provider: 'BASIC',
      email: user.email,
      providers: [{ provider: 'BASIC', email: user.email }],
    });
  });

  it('MYPAGE-BE-R1 소셜로 로그인한 토큰이면 provider가 그 소셜 방식이고, 목록에는 연결된 방식이 모두 온다 (L1-09, L1-10)', async () => {
    const user = await emailUser();
    const kakaoEmail = `qa-kakao-${randomBytes(3).toString('hex')}@example.com`;
    await prisma.auth_providers.create({
      data: {
        auth_account_id: user.accountId,
        provider: 'KAKAO',
        provider_email: kakaoEmail,
        provider_user_id: `qa${Date.now()}`,
      },
    });
    const socialToken = signAccessToken(user.accountId, 'USER', 'KAKAO');
    const res = await api().get('/auth/account').set(bearer(socialToken));
    expect(res.body).toEqual({
      provider: 'KAKAO',
      email: kakaoEmail,
      providers: [
        { provider: 'BASIC', email: user.email },
        { provider: 'KAKAO', email: kakaoEmail },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
describe('MYPAGE BE · 닉네임 PATCH /users/me', () => {
  it.each([
    ['1자', '가'],
    ['21자', '가'.repeat(21)],
    ['공백 뺀 1자', '  가  '],
  ])(
    'MYPAGE-BE-02a 닉네임 %s면 400 VALIDATION_FAILED',
    async (_label, nickname) => {
      const user = await emailUser();
      const res = await changeNickname(user.accessToken, { nickname });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it('MYPAGE-BE-02b 다른 계정이 쓰는 닉네임이면 대소문자가 달라도, 작가 활동명이어도 409 NICKNAME_ALREADY_EXISTS (L1-08)', async () => {
    const user = await emailUser();
    const other = await emailUser();
    const photographer = await createPhotographerAccount('QAMyPage');
    for (const nickname of [
      other.nickname,
      photographer.nickname.toLowerCase(),
    ]) {
      const res = await changeNickname(user.accessToken, { nickname });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('NICKNAME_ALREADY_EXISTS');
    }
  });

  it('MYPAGE-BE-02c 닉네임 2·20자는 받고 앞뒤 공백은 빼고 저장한다', async () => {
    const user = await emailUser();
    const two = `${randomBytes(1).toString('hex').slice(0, 1)}가`;
    expect(
      (await changeNickname(user.accessToken, { nickname: two })).status,
    ).toBe(200);
    const twenty = `  QA${randomBytes(9).toString('hex')}  `;
    const res = await changeNickname(user.accessToken, { nickname: twenty });
    expect(res.status).toBe(200);
    expect(
      (await api().get('/users/me').set(bearer(user.accessToken))).body
        .nickname,
    ).toBe(twenty.trim());
  });

  it('MYPAGE-BE-02d 닉네임 말고 다른 필드를 보내면 400 VALIDATION_FAILED', async () => {
    const user = await emailUser();
    const res = await changeNickname(user.accessToken, {
      nickname: 'QA정상닉네임',
      profileImageUrl: 'x',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('MYPAGE-BE-R2 닉네임을 바꾸면 /users/me·작가의 채팅 목록·리뷰 작성자 이름에 새 닉네임이 보인다 (L2-01)', async () => {
    const user = await emailUser();
    const photographer = await createPhotographerAccount('QAMyPageP');
    const userRow = await prisma.users.findUniqueOrThrow({
      where: { auth_account_id: user.accountId },
    });
    const room = await prisma.chat_rooms.create({
      data: {
        user_id: userRow.id,
        photographer_id: photographer.photographerId,
      },
    });
    await api()
      .post(`/chats/${room.id}/messages`)
      .set(bearer(user.accessToken))
      .send({ messageType: 'TEXT', content: 'QA' });
    const reservation = await prisma.reservations.create({
      data: {
        user_id: userRow.id,
        photographer_id: photographer.photographerId,
        status: 'PURCHASE_CONFIRMED',
        shoot_at: new Date(),
        location: '서울',
        total_amount: 0,
      },
    });
    await prisma.reviews.create({
      data: {
        reservation_id: reservation.id,
        user_id: userRow.id,
        photographer_id: photographer.photographerId,
        rating: 5,
        comment: 'QA',
      },
    });

    const nickname = `QA바뀐닉_${randomBytes(3).toString('hex')}`;
    expect((await changeNickname(user.accessToken, { nickname })).status).toBe(
      200,
    );

    expect(
      (await api().get('/users/me').set(bearer(user.accessToken))).body
        .nickname,
    ).toBe(nickname);
    const chats = (await api().get('/chats').set(bearer(photographer.token)))
      .body.items;
    expect(
      chats.find(({ id }: { id: string }) => id === room.id)?.partner.nickname,
    ).toBe(nickname);
    const reviews = (
      await api().get(`/photographers/${photographer.photographerId}/reviews`)
    ).body.items;
    expect(reviews[0]?.author.nickname).toBe(nickname);
  });
});

// ---------------------------------------------------------------------------
describe('MYPAGE BE · 비밀번호 PATCH /auth/password', () => {
  it('MYPAGE-BE-03 현재 비밀번호가 틀리면 400 INVALID_CURRENT_PASSWORD, 새 비밀번호가 같으면 400 SAME_AS_CURRENT_PASSWORD', async () => {
    const user = await emailUser();
    const wrong = await changePassword(user.accessToken, {
      currentPassword: 'wrongPass1!',
      newPassword: NEW_PASSWORD,
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('INVALID_CURRENT_PASSWORD');
    const same = await changePassword(user.accessToken, {
      currentPassword: PASSWORD,
      newPassword: PASSWORD,
    });
    expect(same.status).toBe(400);
    expect(same.body.code).toBe('SAME_AS_CURRENT_PASSWORD');
  });

  it.each([
    ['새 비밀번호 7자', { currentPassword: PASSWORD, newPassword: 'qaPas1!' }],
    [
      '새 비밀번호 17자',
      { currentPassword: PASSWORD, newPassword: 'qaPassword12345!!' },
    ],
    [
      '정해지지 않은 필드',
      {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      },
    ],
  ])('MYPAGE-BE-04 %s면 400 VALIDATION_FAILED', async (_label, body) => {
    const user = await emailUser();
    const res = await changePassword(user.accessToken, body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('MYPAGE-BE-05 소셜로 로그인한 토큰으로 바꾸면 403 PASSWORD_CHANGE_NOT_ALLOWED (이메일 계정이 연결돼 있어도)', async () => {
    const user = await emailUser();
    const socialToken = signAccessToken(user.accountId, 'USER', 'KAKAO');
    const res = await changePassword(socialToken, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_NOT_ALLOWED');
  });

  it('MYPAGE-BE-R3 비밀번호를 바꾸면 새 비밀번호로 로그인되고 옛 비밀번호는 401 INVALID_CREDENTIALS (L2-02)', async () => {
    const user = await emailUser();
    const res = await changePassword(
      user.accessToken,
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      user.cookie,
    );
    expect(res.status).toBe(204);
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
    const old = await login(user.email, PASSWORD);
    expect(old.status).toBe(401);
    expect(old.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('MYPAGE-BE-R4 두 세션 중 한쪽에서 바꾸면 바꾼 세션은 유지되고 다른 세션의 토큰 갱신은 401 (L2-03)', async () => {
    const user = await emailUser();
    const other = await login(user.email, PASSWORD);
    const otherCookie = refreshCookie(other)!;

    await changePassword(
      user.accessToken,
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      user.cookie,
    );
    expect((await refresh(user.cookie)).status).toBe(200);
    const kicked = await refresh(otherCookie);
    expect(kicked.status).toBe(401);
    expect(kicked.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('MYPAGE-BE-R5 숫자만 8자인 새 비밀번호로 바꾼 응답을 기록 (L1-15 서버 쪽)', async () => {
    const user = await emailUser();
    const res = await changePassword(
      user.accessToken,
      { currentPassword: PASSWORD, newPassword: '12345678' },
      user.cookie,
    );
    recorder.record('MYPAGE-BE-R5', {
      status: res.status,
      code: res.body?.code ?? null,
    });
  });
});

// ---------------------------------------------------------------------------
describe('MYPAGE AC · 접근 제어', () => {
  it('MYPAGE-AC-01 비회원이 GET /auth/account · PATCH /users/me · PATCH /auth/password면 401 UNAUTHORIZED', async () => {
    for (const res of [
      await api().get('/auth/account'),
      await changeNickname(null, { nickname: 'QA비회원' }),
      await changePassword(null, {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('MYPAGE-AC-02 작가 토큰으로 PATCH /users/me 닉네임 변경한 응답 코드를 기록', async () => {
    const photographer = await emailUser('PHOTOGRAPHER');
    const res = await changeNickname(photographer.accessToken, {
      nickname: `QA작가닉_${randomBytes(2).toString('hex')}`,
    });
    recorder.record('MYPAGE-AC-02', {
      status: res.status,
      code: res.body.code ?? null,
    });
  });
});
