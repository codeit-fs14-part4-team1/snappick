/**
 * PROFEDIT QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - 수정 모드의 임시 반영·저장 순서·안내 토스트는 화면 동작이라 여기서 보지 않는다
 */
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder, tokenFor } from '../helpers.js';
import { createPhotographerAccount, createUserAccount } from '../fixtures.js';

const recorder = createRecorder('PROFEDIT BE · AC');
let u1: Awaited<ReturnType<typeof createUserAccount>>;
let p7: Awaited<ReturnType<typeof createPhotographerAccount>>;

beforeAll(async () => {
  u1 = await createUserAccount('QA수정U1');
  p7 = await createPhotographerAccount('QA수정P7');
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

/** 활동명 말고는 아무것도 채우지 않은 작가 (TD-1 거의 비움) */
async function emptyPhotographer() {
  const account = await prisma.auth_accounts.create({
    data: {
      account_type: 'PHOTOGRAPHER',
      nickname: `QA빈작가_${randomBytes(3).toString('hex')}`,
    },
  });
  const photographer = await prisma.photographers.create({
    data: { auth_account_id: account.id },
  });
  return {
    photographerId: photographer.id,
    accountId: account.id,
    token: await tokenFor(account.id),
  };
}

const edit = (token: string | null, body: unknown) => {
  const req = api()
    .patch('/photographers/me')
    .send(body as object);
  return token ? req.set(bearer(token)) : req;
};
const readiness = async (token: string) =>
  (await api().get('/photographers/me/readiness').set(bearer(token))).body as {
    isReady: boolean;
    missing: string[];
  };
const uploadUrl = (token: string | null, body: Record<string, unknown>) => {
  const req = api().post('/me/profile-image/upload-url').send(body);
  return token ? req.set(bearer(token)) : req;
};

const FULL = {
  career: 5,
  regions: ['SEOUL', 'GYEONGGI'],
  categories: ['WEDDING', 'PROFILE'],
  introduction: 'QA 자연광 스냅을 찍어요',
};

// ---------------------------------------------------------------------------
describe('PROFEDIT BE · 기본 정보 PATCH /photographers/me', () => {
  it('PROFEDIT-BE-01 정상 요청이면 200과 바뀐 프로필, 다른 계정이 봐도 같은 값 (L2-01)', async () => {
    const p = await emptyPhotographer();
    const nickname = `QA새이름_${randomBytes(2).toString('hex')}`;
    const res = await edit(p.token, { ...FULL, nickname });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...FULL, nickname, id: p.photographerId });

    const seen = (
      await api()
        .get(`/photographers/${p.photographerId}`)
        .set(bearer(u1.token))
    ).body;
    expect(seen).toMatchObject({ ...FULL, nickname });
  });

  it.each([
    ['본문이 비었음', {}],
    [
      '정해지지 않은 필드',
      { nickname: 'QA정상이름', website: 'https://example.com' },
    ],
  ])('PROFEDIT-BE-02 %s이면 400 VALIDATION_FAILED', async (_label, body) => {
    const p = await emptyPhotographer();
    const res = await edit(p.token, body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it.each([
    ['활동명 1자', { nickname: '가' }],
    ['활동명 21자', { nickname: '가'.repeat(21) }],
    ['활동명 공백뿐', { nickname: '    ' }],
    ['경력 -1', { career: -1 }],
    ['경력 81', { career: 81 }],
    ['경력 소수', { career: 1.5 }],
    ['소개 1,001자', { introduction: '가'.repeat(1001) }],
    ['소개 빈 문자열', { introduction: '' }],
  ])('PROFEDIT-BE-03 %s이면 400 VALIDATION_FAILED', async (_label, body) => {
    const p = await emptyPhotographer();
    const res = await edit(p.token, body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('PROFEDIT-BE-03b 경계값(활동명 2·20자, 경력 0·80, 소개 1,000자)과 소개 null은 받는다', async () => {
    const p = await emptyPhotographer();
    for (const body of [
      {
        nickname: `가${randomBytes(1).toString('hex').slice(0, 1)}`,
        career: 0,
        introduction: '가'.repeat(1000),
      },
      {
        nickname: `QA${randomBytes(9).toString('hex')}`,
        career: 80,
        introduction: null,
      },
    ]) {
      const res = await edit(p.token, body);
      expect(res.status).toBe(200);
    }
  });

  it('PROFEDIT-BE-R1 경력 0으로 저장하면 프로필의 career가 0이다 ("경력 1년 이하" 표시용, L2-04)', async () => {
    const p = await emptyPhotographer();
    await edit(p.token, { career: 0 });
    expect(
      (await api().get(`/photographers/${p.photographerId}`)).body.career,
    ).toBe(0);
  });

  it('PROFEDIT-BE-04 다른 계정이 쓰는 활동명이면 409 NICKNAME_ALREADY_EXISTS, 같이 보낸 값도 저장되지 않는다 (L2-05)', async () => {
    const p = await emptyPhotographer();
    const res = await edit(p.token, {
      nickname: p7.nickname.toUpperCase(),
      introduction: 'QA 저장되면 안 됨',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NICKNAME_ALREADY_EXISTS');
    const saved = await prisma.photographers.findUniqueOrThrow({
      where: { id: p.photographerId },
    });
    expect(saved.introduction).toBeNull();
  });

  it('PROFEDIT-BE-04b 일반 계정의 닉네임과 겹쳐도 409 (일반·작가 닉네임은 함께 겹칠 수 없다)', async () => {
    const p = await emptyPhotographer();
    const res = await edit(p.token, { nickname: u1.nickname });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NICKNAME_ALREADY_EXISTS');
  });

  it('PROFEDIT-L2-08 같은 작가가 두 탭에서 서로 다른 소개로 동시에 저장하면 마지막에 남는 값을 기록 (L2-08)', async () => {
    const p = await emptyPhotographer();
    const [a, b] = await Promise.all([
      edit(p.token, { introduction: 'QA 탭 A 소개' }),
      edit(p.token, { introduction: 'QA 탭 B 소개' }),
    ]);
    const saved = await prisma.photographers.findUniqueOrThrow({
      where: { id: p.photographerId },
    });
    recorder.record('PROFEDIT-L2-08', {
      'A 응답': a.status,
      'B 응답': b.status,
      남은값: saved.introduction,
    });
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(['QA 탭 A 소개', 'QA 탭 B 소개']).toContain(saved.introduction);
  });
});

// ---------------------------------------------------------------------------
describe('PROFEDIT BE · 준비 상태 GET /photographers/me/readiness', () => {
  it('PROFEDIT-BE-05 빠진 항목을 missing에 담고, 모두 채우면 isReady: true (L2-03)', async () => {
    const p = await emptyPhotographer();
    expect(await readiness(p.token)).toMatchObject({
      isReady: false,
      missing: [
        'profileImage',
        'regions',
        'career',
        'categories',
        'introduction',
      ],
    });

    await edit(p.token, FULL);
    expect(await readiness(p.token)).toMatchObject({
      isReady: false,
      missing: ['profileImage'],
    });

    // 프로필 이미지는 업로드 흐름을 거치므로 DB로 채운다
    await prisma.photographers.update({
      where: { id: p.photographerId },
      data: { profile_image_url: 'qa/profile.webp' },
    });
    expect(await readiness(p.token)).toMatchObject({
      isReady: true,
      missing: [],
    });
    // 다른 계정이 봐도 준비 완료 프로필
    expect(
      (
        await api()
          .get(`/photographers/${p.photographerId}`)
          .set(bearer(u1.token))
      ).body.isReady,
    ).toBe(true);
  });

  it('PROFEDIT-BE-R4 소개를 null로 지우면 다시 missing에 introduction이 생긴다', async () => {
    const p = await emptyPhotographer();
    await edit(p.token, FULL);
    await edit(p.token, { introduction: null });
    expect((await readiness(p.token)).missing).toContain('introduction');
  });
});

// ---------------------------------------------------------------------------
describe('PROFEDIT BE · 프로필 이미지 POST /me/profile-image/upload-url', () => {
  it('PROFEDIT-BE-06 허용하지 않는 형식이나 5MB를 넘는 크기로 업로드 주소를 요청한 응답 코드를 기록', async () => {
    const p = await emptyPhotographer();
    const cases = {
      GIF: { contentType: 'image/gif', fileSize: 1000 },
      '5MB + 1바이트': {
        contentType: 'image/png',
        fileSize: 5 * 1024 * 1024 + 1,
      },
      '0바이트': { contentType: 'image/jpeg', fileSize: 0 },
    };
    const results: Record<string, string> = {};
    for (const [label, body] of Object.entries(cases)) {
      const res = await uploadUrl(p.token, body);
      results[label] = `${res.status} ${res.body.code ?? ''}`.trim();
    }
    recorder.record('PROFEDIT-BE-06', results);
  });

  it.each([
    ['image/jpeg', 1000],
    ['image/png', 5 * 1024 * 1024],
    ['image/webp', 1000],
  ])(
    'PROFEDIT-BE-06b %s, %i바이트는 업로드 주소가 발급된다',
    async (contentType, fileSize) => {
      const p = await emptyPhotographer();
      const res = await uploadUrl(p.token, { contentType, fileSize });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        uploadKey: expect.stringContaining(p.accountId),
        uploadUrl: expect.any(String),
      });
    },
  );
});

// ---------------------------------------------------------------------------
describe('PROFEDIT AC · 접근 제어', () => {
  it('PROFEDIT-AC-01 비회원이 PATCH /photographers/me · POST /me/profile-image/upload-url이면 401 UNAUTHORIZED', async () => {
    for (const res of [
      await edit(null, { career: 3 }),
      await uploadUrl(null, { contentType: 'image/png', fileSize: 1000 }),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('PROFEDIT-AC-02 일반 토큰으로 PATCH /photographers/me면 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    const res = await edit(u1.token, { career: 3 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
  });
});
