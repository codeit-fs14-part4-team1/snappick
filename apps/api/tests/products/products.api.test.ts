/**
 * PRODUCT QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - 화면의 임시 반영·수정 취소(L1-04·05, L2-04)는 저장 전 화면 동작이라 여기서 보지 않는다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder } from '../helpers.js';
import { createPhotographerAccount, createUserAccount } from '../fixtures.js';

type Photographer = Awaited<ReturnType<typeof createPhotographerAccount>>;

const recorder = createRecorder('PRODUCT BE · AC');

let u1: Awaited<ReturnType<typeof createUserAccount>>;
let p7: Photographer;

/** 기본 정보를 다 채운 작가 (상품 0개) */
async function readyPhotographer(prefix = 'QA상품작가') {
  const photographer = await createPhotographerAccount(prefix);
  await prisma.photographers.update({
    where: { id: photographer.photographerId },
    data: { profile_image_url: 'qa/profile.webp' },
  });
  return photographer;
}

beforeAll(async () => {
  u1 = await createUserAccount('QA상품U1');
  p7 = await readyPhotographer('QA상품P7');
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

const VALID = {
  name: 'QA 프로필 촬영',
  price: 120_000,
  durationMinutes: 90,
  photoCount: 20,
  includesOriginal: true,
  commonNotice: 'QA 공통 안내',
};

const add = (token: string | null, body: Record<string, unknown> = VALID) => {
  const req = api().post('/photographers/me/products').send(body);
  return token ? req.set(bearer(token)) : req;
};
const edit = (
  token: string | null,
  productId: string,
  body: Record<string, unknown>,
) => {
  const req = api().patch(`/photographers/me/products/${productId}`).send(body);
  return token ? req.set(bearer(token)) : req;
};
const remove = (token: string | null, productId: string) => {
  const req = api().delete(`/photographers/me/products/${productId}`);
  return token ? req.set(bearer(token)) : req;
};
/** 방문자 화면의 상품 목록 */
const publicProducts = async (photographerId: string) =>
  (await api().get(`/photographers/${photographerId}/products`)).body.items as {
    productId: string;
    name: string;
    price: number;
  }[];

// ---------------------------------------------------------------------------
describe('PRODUCT BE · 상품 /photographers/me/products', () => {
  it('PRODUCT-BE-01 정상 요청이면 201과 상품이 온다', async () => {
    const p = await readyPhotographer();
    const res = await add(p.token);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...VALID, productId: expect.any(String) });
  });

  it('PRODUCT-BE-R1 추가하면 방문자 화면에 등록한 순서대로 보인다 (L2-01)', async () => {
    const p = await readyPhotographer();
    const ids = [];
    for (const name of ['QA 첫째', 'QA 둘째', 'QA 셋째']) {
      ids.push((await add(p.token, { ...VALID, name })).body.productId);
    }
    expect(
      (await publicProducts(p.photographerId)).map(
        ({ productId }) => productId,
      ),
    ).toEqual(ids);
  });

  it('PRODUCT-BE-02 상품이 이미 3개면 409 PRODUCT_LIMIT_EXCEEDED', async () => {
    const p = await readyPhotographer();
    for (let i = 0; i < 3; i++) await add(p.token);
    const res = await add(p.token);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PRODUCT_LIMIT_EXCEEDED');
    expect(
      await prisma.products.count({
        where: { photographer_id: p.photographerId },
      }),
    ).toBe(3);
  });

  it('PRODUCT-BE-R2 3개 중 하나를 지우고 새로 추가하면 정상 저장되고 3개가 된다 (L2-05, 저장 순서: 삭제 → 추가)', async () => {
    const p = await readyPhotographer();
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await add(p.token)).body.productId);
    expect((await remove(p.token, ids[0])).status).toBe(204);
    expect((await add(p.token, { ...VALID, name: 'QA 새 상품' })).status).toBe(
      201,
    );
    expect(
      await prisma.products.count({
        where: { photographer_id: p.photographerId },
      }),
    ).toBe(3);
  });

  it('PRODUCT-BE-R3 두 탭에서 동시에 추가해 3개를 넘기면 하나만 저장되고 늦은 쪽은 409 (L2-09)', async () => {
    const p = await readyPhotographer();
    await add(p.token);
    await add(p.token);
    const results = await Promise.all([
      add(p.token, { ...VALID, name: 'QA 탭 1' }),
      add(p.token, { ...VALID, name: 'QA 탭 2' }),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(results.find(({ status }) => status === 409)?.body.code).toBe(
      'PRODUCT_LIMIT_EXCEEDED',
    );
    expect(
      await prisma.products.count({
        where: { photographer_id: p.photographerId },
      }),
    ).toBe(3);
  });

  it.each([
    ['상품명 0자', { name: '' }],
    ['상품명 공백뿐', { name: '   ' }],
    ['상품명 51자', { name: '가'.repeat(51) }],
    ['가격 0', { price: 0 }],
    ['가격 100,000,001', { price: 100_000_001 }],
    ['촬영 시간 59분', { durationMinutes: 59 }],
    ['촬영 시간 2,881분', { durationMinutes: 2881 }],
    ['사진 수 0', { photoCount: 0 }],
    ['사진 수 10,001', { photoCount: 10_001 }],
    ['사진 수 1.5', { photoCount: 1.5 }],
    ['공통 안내 1,001자', { commonNotice: '가'.repeat(1001) }],
  ])('PRODUCT-BE-03 %s면 400 VALIDATION_FAILED', async (_label, override) => {
    const p = await readyPhotographer();
    const res = await add(p.token, { ...VALID, ...override });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(
      await prisma.products.count({
        where: { photographer_id: p.photographerId },
      }),
    ).toBe(0);
  });

  it('PRODUCT-BE-03b 경계값(상품명 50자, 가격 1·100,000,000, 촬영 60·2,880분, 사진 1·10,000장, 안내 1,000자·생략)은 받는다', async () => {
    const p = await readyPhotographer();
    for (const override of [
      {
        name: '가'.repeat(50),
        price: 1,
        durationMinutes: 60,
        photoCount: 1,
        commonNotice: '가'.repeat(1000),
      },
      {
        price: 100_000_000,
        durationMinutes: 2880,
        photoCount: 10_000,
        commonNotice: undefined,
      },
    ]) {
      const res = await add(p.token, { ...VALID, ...override });
      expect(res.status).toBe(201);
    }
  });

  it('PRODUCT-BE-R4 1원으로 저장한 상품은 방문자 목록에 1원으로 온다 (L2-07)', async () => {
    const p = await readyPhotographer();
    await add(p.token, { ...VALID, price: 1 });
    expect((await publicProducts(p.photographerId))[0]?.price).toBe(1);
  });

  it('PRODUCT-BE-04 정해지지 않은 필드를 넣으면 400 VALIDATION_FAILED', async () => {
    const p = await readyPhotographer();
    const res = await add(p.token, { ...VALID, discount: 10 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('PRODUCT-BE-05 PATCH에 바꿀 값이 없으면 400, 없는 상품이면 404 PRODUCT_NOT_FOUND, UUID가 아니면 400', async () => {
    const p = await readyPhotographer();
    const { productId } = (await add(p.token)).body;
    const empty = await edit(p.token, productId, {});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('VALIDATION_FAILED');

    const missing = await edit(p.token, randomUUID(), { price: 1000 });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('PRODUCT_NOT_FOUND');

    const invalid = await edit(p.token, 'not-a-uuid', { price: 1000 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
  });

  it('PRODUCT-BE-06 없는 상품을 DELETE하면 404 PRODUCT_NOT_FOUND', async () => {
    const p = await readyPhotographer();
    const res = await remove(p.token, randomUUID());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('PRODUCT-BE-07 기본 정보를 덜 채운 작가 토큰으로 상품을 등록한 응답을 기록', async () => {
    // 프로필 사진이 없는 작가 (화면은 상품 추가를 막는다)
    const notReady = await createPhotographerAccount('QA상품준비중');
    const res = await add(notReady.token);
    recorder.record('PRODUCT-BE-07', {
      status: res.status,
      code: res.body.code ?? null,
    });
  });

  it('PRODUCT-BE-08 PATCH 정상이면 200과 고친 상품, DELETE 정상이면 204 (L2-02, L2-03)', async () => {
    const p = await readyPhotographer();
    const { productId } = (await add(p.token)).body;
    const patched = await edit(p.token, productId, {
      name: 'QA 고친 이름',
      price: 99_000,
      commonNotice: null,
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      productId,
      name: 'QA 고친 이름',
      price: 99_000,
      commonNotice: null,
    });
    expect((await publicProducts(p.photographerId))[0]).toMatchObject({
      name: 'QA 고친 이름',
      price: 99_000,
    });

    const deleted = await remove(p.token, productId);
    expect(deleted.status).toBe(204);
    expect(await publicProducts(p.photographerId)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('PRODUCT AC · 접근 제어', () => {
  it('PRODUCT-AC-01 비회원이 POST·PATCH·DELETE면 401 UNAUTHORIZED', async () => {
    const productId = randomUUID();
    for (const res of [
      await add(null),
      await edit(null, productId, { price: 1000 }),
      await remove(null, productId),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('PRODUCT-AC-02 일반 토큰이면 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    const { productId } = (await add(p7.token)).body;
    for (const res of [
      await add(u1.token),
      await edit(u1.token, productId, { price: 1000 }),
      await remove(u1.token, productId),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
    }
  });

  it('PRODUCT-AC-03 다른 작가의 상품을 PATCH·DELETE하면 404 PRODUCT_NOT_FOUND, 아무것도 바뀌지 않음', async () => {
    const owner = await readyPhotographer('QA상품주인');
    const { productId } = (await add(owner.token)).body;
    const before = await prisma.products.findUniqueOrThrow({
      where: { id: productId },
    });

    for (const res of [
      await edit(p7.token, productId, { name: 'QA 남의 상품', price: 1 }),
      await remove(p7.token, productId),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
    }
    expect(
      await prisma.products.findUniqueOrThrow({ where: { id: productId } }),
    ).toEqual(before);
  });
});
