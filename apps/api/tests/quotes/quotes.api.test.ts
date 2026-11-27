/**
 * QUOTE QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - BE-10(탈퇴 상대)은 문서에서 1차 보류지만, 테스트 DB에서는 채팅방의 사용자를 비워 바로 만들 수 있어 넣었다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReservationStatus } from '../../src/generated/prisma/enums.js';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder } from '../helpers.js';
import {
  DAY_MS,
  createPayment,
  createPhotographerAccount,
  createReservationRecord,
  createUserAccount,
} from '../fixtures.js';

const recorder = createRecorder('QUOTE BE · AC');

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** days일 뒤 한국 시간 14:00 (+09:00 표기) */
const kstAfternoon = (days: number) => {
  const date = new Date(Date.now() + KST_OFFSET_MS + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return `${date}T14:00:00+09:00`;
};

let u1: Awaited<ReturnType<typeof createUserAccount>>;
let u3: Awaited<ReturnType<typeof createUserAccount>>;
let p1: Awaited<ReturnType<typeof createPhotographerAccount>>;
let p7: Awaited<ReturnType<typeof createPhotographerAccount>>;
let roomU1P1 = '';
let productP1 = '';
let productP7 = '';

const createRoom = (userId: string | null, photographerId: string) =>
  prisma.chat_rooms.create({
    data: { user_id: userId, photographer_id: photographerId },
  });

const createProduct = (photographerId: string, commonNotice: string | null) =>
  prisma.products.create({
    data: {
      photographer_id: photographerId,
      name: 'QA 프로필 촬영',
      price: 120_000,
      duration_minutes: 90,
      photo_count: 20,
      includes_original: false,
      common_notice: commonNotice,
    },
  });

beforeAll(async () => {
  u1 = await createUserAccount('QA견적U1');
  u3 = await createUserAccount('QA견적U3');
  p1 = await createPhotographerAccount('QA견적P1');
  p7 = await createPhotographerAccount('QA견적P7');
  roomU1P1 = (await createRoom(u1.userId, p1.photographerId)).id;
  productP1 = (await createProduct(p1.photographerId, 'QA 공통 안내')).id;
  productP7 = (await createProduct(p7.photographerId, null)).id;
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

/** 견적 본문 (기본: U1–P1 방, P1 상품으로 새 견적) */
const quoteBody = (override: Record<string, unknown> = {}) => ({
  chatRoomId: roomU1P1,
  productId: productP1,
  quoteName: 'QA 성수 프로필 촬영',
  shootAt: kstAfternoon(20),
  location: '서울 성동구 성수동',
  locationLat: 37.544,
  locationLng: 127.056,
  durationMinutes: 120,
  price: 150_000,
  photoCount: 30,
  includesOriginal: true,
  ...override,
});

const sendQuote = (token: string | null, body: Record<string, unknown>) => {
  const req = api().post('/quotes').send(body);
  return token ? req.set(bearer(token)) : req;
};

const getQuote = (quoteId: string, token: string | null) => {
  const req = api().get(`/quotes/${quoteId}`);
  return token ? req.set(bearer(token)) : req;
};

/** 재견적 본문 (상품 없이 촬영 건과 기준 버전으로) */
const requoteBody = (
  chatRoomId: string,
  shootingCaseId: string,
  expectedVersion: number,
  override: Record<string, unknown> = {},
) =>
  quoteBody({
    chatRoomId,
    shootingCaseId,
    expectedVersion,
    productId: undefined,
    quoteName: 'QA 재견적',
    ...override,
  });

/** 상태를 정한 U1–P1 예약의 촬영 건 */
async function caseWithReservation(status: ReservationStatus) {
  const reservation = await createReservationRecord({
    userId: u1.userId,
    photographerId: p1.photographerId,
    status,
    createdAt: new Date(Date.now() - DAY_MS),
  });
  return prisma.quotes.findUniqueOrThrow({
    where: { id: reservation.quote_id! },
  });
}

const versionsOf = async (shootingCaseId: string) =>
  (
    await prisma.quotes.findMany({
      where: { shooting_case_id: shootingCaseId },
      orderBy: { version: 'asc' },
      select: { version: true },
    })
  ).map(({ version }) => version);

// ---------------------------------------------------------------------------
describe('QUOTE BE · 견적 보내기 POST /quotes', () => {
  it('QUOTE-BE-01 상품을 골라 새 견적을 보내면 201, version 1, isLatest true', async () => {
    const res = await sendQuote(p1.token, quoteBody());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      chatRoomId: roomU1P1,
      version: 1,
      isLatest: true,
      reservationStatus: null,
      paymentPending: false,
      quoteName: 'QA 성수 프로필 촬영',
      price: 150_000,
      commonNotice: 'QA 공통 안내',
    });
    expect(res.body.shootingCaseId).toBeTruthy();
    // 견적 카드 메시지가 채팅방에 남는다 (L2-01 서버 쪽)
    expect(
      await prisma.chat_messages.count({
        where: { quote_id: res.body.id, message_type: 'QUOTE' },
      }),
    ).toBe(1);
  });

  it('QUOTE-BE-02 shootingCaseId와 최신 expectedVersion으로 보내면 버전이 1 올라간다 (L2-02)', async () => {
    const first = (await sendQuote(p1.token, quoteBody())).body;
    const res = await sendQuote(
      p1.token,
      requoteBody(roomU1P1, first.shootingCaseId, 1),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      shootingCaseId: first.shootingCaseId,
      version: 2,
      isLatest: true,
    });
    // 상품 없이 보낸 재견적은 이전 견적의 공통 안내를 이어받는다
    expect(res.body.commonNotice).toBe('QA 공통 안내');

    expect((await getQuote(first.id, u1.token)).body.isLatest).toBe(false);
    expect((await getQuote(res.body.id, u1.token)).body.isLatest).toBe(true);
  });

  it('QUOTE-BE-03 expectedVersion이 최신이 아니면 409 QUOTE_VERSION_CONFLICT', async () => {
    const first = (await sendQuote(p1.token, quoteBody())).body;
    await sendQuote(p1.token, requoteBody(roomU1P1, first.shootingCaseId, 1));
    const stale = await sendQuote(
      p1.token,
      requoteBody(roomU1P1, first.shootingCaseId, 1),
    );
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('QUOTE_VERSION_CONFLICT');
    expect(await versionsOf(first.shootingCaseId)).toEqual([1, 2]);
  });

  it.each([
    ['productId·shootingCaseId 둘 다 없음', { productId: undefined }],
    [
      'shootingCaseId만 있고 expectedVersion 없음',
      { productId: undefined, shootingCaseId: randomUUID() },
    ],
  ])('QUOTE-BE-04 %s이면 400 VALIDATION_FAILED', async (_label, override) => {
    const res = await sendQuote(p1.token, quoteBody(override));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it.each([
    ['견적명 51자', { quoteName: '가'.repeat(51) }],
    ['금액 -1', { price: -1 }],
    ['금액 100,000,001', { price: 100_000_001 }],
    ['촬영 시간 59분', { durationMinutes: 59 }],
    ['촬영 시간 2,881분', { durationMinutes: 2881 }],
    ['제공 사진 0', { photoCount: 0 }],
    ['제공 사진 10,001', { photoCount: 10_001 }],
    ['제공 사진 빈 값', { photoCount: undefined }],
    ['위도 91', { locationLat: 91 }],
    ['추가 안내 1,001자', { additionalNotice: '가'.repeat(1001) }],
  ])('QUOTE-BE-05 %s이면 400 VALIDATION_FAILED', async (_label, override) => {
    const res = await sendQuote(p1.token, quoteBody(override));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('QUOTE-BE-05b 경계값(견적명 50자, 금액 0·100,000,000, 촬영 60·2,880분, 사진 1·10,000장, 안내 1,000자)은 받는다', async () => {
    for (const override of [
      {
        quoteName: '가'.repeat(50),
        price: 0,
        durationMinutes: 60,
        photoCount: 1,
      },
      {
        price: 100_000_000,
        durationMinutes: 2880,
        photoCount: 10_000,
        additionalNotice: '가'.repeat(1000),
      },
    ]) {
      const res = await sendQuote(p1.token, quoteBody(override));
      expect(res.status).toBe(201);
    }
  });

  it.each(['CONFIRMED', 'SHOOT_COMPLETED', 'DELIVERED'] as const)(
    'QUOTE-BE-06 진행 중 예약(%s)이 있는 촬영 건에 재견적이면 409 ACTIVE_RESERVATION_EXISTS',
    async (status) => {
      const quote = await caseWithReservation(status);
      const res = await sendQuote(
        p1.token,
        requoteBody(quote.chat_room_id!, quote.shooting_case_id, quote.version),
      );
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACTIVE_RESERVATION_EXISTS');
    },
  );

  it('QUOTE-BE-07 결제 대기(PENDING) 중인 촬영 건에 재견적이면 409 PAYMENT_IN_PROGRESS, 새 견적 없음 (L2-07)', async () => {
    const payment = await createPayment({
      userId: u1.userId,
      photographerId: p1.photographerId,
      status: 'PENDING',
    });
    const quote = await prisma.quotes.findUniqueOrThrow({
      where: { id: payment.quote_id! },
    });
    const res = await sendQuote(
      p1.token,
      requoteBody(quote.chat_room_id!, quote.shooting_case_id, quote.version),
    );
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_IN_PROGRESS');
    expect(await versionsOf(quote.shooting_case_id)).toEqual([quote.version]);
    // 견적 카드에는 결제 확인 중으로 보인다 (L1-31 서버 쪽)
    expect((await getQuote(quote.id, p1.token)).body.paymentPending).toBe(true);
  });

  it('QUOTE-BE-08 과거 시각의 shootAt으로 보낸 응답을 기록', async () => {
    const res = await sendQuote(
      p1.token,
      quoteBody({ shootAt: kstAfternoon(-1) }),
    );
    recorder.record('QUOTE-BE-08', {
      status: res.status,
      code: res.body.code ?? null,
    });
  });

  it('QUOTE-BE-09 없는 상품이면 404 PRODUCT_NOT_FOUND, 없는 촬영 건이면 404 SHOOTING_CASE_NOT_FOUND', async () => {
    const product = await sendQuote(
      p1.token,
      quoteBody({ productId: randomUUID() }),
    );
    expect(product.status).toBe(404);
    expect(product.body.code).toBe('PRODUCT_NOT_FOUND');

    const shootingCase = await sendQuote(
      p1.token,
      requoteBody(roomU1P1, randomUUID(), 1),
    );
    expect(shootingCase.status).toBe(404);
    expect(shootingCase.body.code).toBe('SHOOTING_CASE_NOT_FOUND');

    // 다른 방의 촬영 건도 없는 것으로 본다
    const otherRoom = (await createRoom(u3.userId, p1.photographerId)).id;
    const other = (
      await sendQuote(p1.token, quoteBody({ chatRoomId: otherRoom }))
    ).body;
    const crossed = await sendQuote(
      p1.token,
      requoteBody(roomU1P1, other.shootingCaseId, 1),
    );
    expect(crossed.status).toBe(404);
    expect(crossed.body.code).toBe('SHOOTING_CASE_NOT_FOUND');
  });

  it('QUOTE-BE-10 탈퇴한 상대의 방이면 422 PARTNER_WITHDRAWN (문서 1차 보류, 테스트 DB로 확인)', async () => {
    const withdrawnRoom = (await createRoom(null, p1.photographerId)).id;
    const res = await sendQuote(
      p1.token,
      quoteBody({ chatRoomId: withdrawnRoom }),
    );
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PARTNER_WITHDRAWN');
  });

  it.each([
    ['CANCELED', 'SHOOTING_CASE_CANCELED'],
    ['PURCHASE_CONFIRMED', 'SHOOTING_CASE_PURCHASE_CONFIRMED'],
  ] as const)(
    'QUOTE-BE-12 %s 촬영 건에 재견적이면 409 %s',
    async (status, code) => {
      const quote = await caseWithReservation(status);
      const res = await sendQuote(
        p1.token,
        requoteBody(quote.chat_room_id!, quote.shooting_case_id, quote.version),
      );
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(code);
    },
  );

  it('QUOTE-BE-R1 촬영 일시는 보낸 한국 시간 그대로 저장·조회된다 (L2-03)', async () => {
    const shootAt = kstAfternoon(15);
    const res = await sendQuote(p1.token, quoteBody({ shootAt }));
    const expected = new Date(shootAt).toISOString();
    expect(res.body.shootAt).toBe(expected);
    expect((await getQuote(res.body.id, u1.token)).body.shootAt).toBe(expected);
  });

  it('QUOTE-BE-R2 견적을 보낸 뒤 상품을 바꿔도 보낸 견적 값은 그대로다 (L2-04)', async () => {
    const product = await createProduct(p1.photographerId, 'QA 바뀌기 전 안내');
    const sent = (
      await sendQuote(p1.token, quoteBody({ productId: product.id }))
    ).body;
    await prisma.products.update({
      where: { id: product.id },
      data: {
        name: 'QA 바뀐 이름',
        price: 999_000,
        common_notice: 'QA 바뀐 안내',
      },
    });
    const body = (await getQuote(sent.id, u1.token)).body;
    expect(body).toMatchObject({
      quoteName: sent.quoteName,
      price: sent.price,
      commonNotice: 'QA 바뀌기 전 안내',
    });
  });

  it('QUOTE-BE-R3 결제가 끝난 방에서 새 견적을 보내면 새 촬영 건의 version 1이다 (L2-05)', async () => {
    const paid = await caseWithReservation('CONFIRMED');
    const res = await sendQuote(
      p1.token,
      quoteBody({ chatRoomId: paid.chat_room_id }),
    );
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(1);
    expect(res.body.shootingCaseId).not.toBe(paid.shooting_case_id);
    // 결제된 견적 카드는 예약 확정 상태로 보인다 (L1-25 서버 쪽)
    expect((await getQuote(paid.id, p1.token)).body.reservationStatus).toBe(
      'CONFIRMED',
    );
  });

  it('QUOTE-BE-R4 같은 최신 견적을 동시에 재견적하면 하나만 나가고 늦은 쪽은 409 QUOTE_VERSION_CONFLICT (L2-06)', async () => {
    const first = (await sendQuote(p1.token, quoteBody())).body;
    const results = await Promise.all([
      sendQuote(
        p1.token,
        requoteBody(roomU1P1, first.shootingCaseId, 1, {
          quoteName: 'QA 탭 1',
        }),
      ),
      sendQuote(
        p1.token,
        requoteBody(roomU1P1, first.shootingCaseId, 1, {
          quoteName: 'QA 탭 2',
        }),
      ),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(results.find(({ status }) => status === 409)?.body.code).toBe(
      'QUOTE_VERSION_CONFLICT',
    );
    expect(await versionsOf(first.shootingCaseId)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
describe('QUOTE BE · 견적 조회 GET /quotes/{id}', () => {
  it('QUOTE-BE-11 방의 일반·작가 토큰이면 200, 없는 견적이면 404 QUOTE_NOT_FOUND', async () => {
    const sent = (await sendQuote(p1.token, quoteBody())).body;
    for (const token of [u1.token, p1.token]) {
      const res = await getQuote(sent.id, token);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: sent.id,
        version: 1,
        isLatest: true,
      });
    }
    const missing = await getQuote(randomUUID(), u1.token);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('QUOTE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
describe('QUOTE AC · 접근 제어', () => {
  it('QUOTE-AC-01 비회원이 POST /quotes · GET /quotes/{id}면 401 UNAUTHORIZED', async () => {
    const sent = (await sendQuote(p1.token, quoteBody())).body;
    for (const res of [
      await sendQuote(null, quoteBody()),
      await getQuote(sent.id, null),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('QUOTE-AC-02 일반 토큰으로 POST /quotes면 403 CHAT_ROOM_ACCESS_DENIED', async () => {
    const res = await sendQuote(u1.token, quoteBody());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CHAT_ROOM_ACCESS_DENIED');
  });

  it('QUOTE-AC-03 다른 작가가 남의 채팅방으로 POST /quotes면 403 CHAT_ROOM_ACCESS_DENIED', async () => {
    const before = await prisma.quotes.count({
      where: { chat_room_id: roomU1P1 },
    });
    const res = await sendQuote(p7.token, quoteBody({ productId: productP7 }));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CHAT_ROOM_ACCESS_DENIED');
    expect(
      await prisma.quotes.count({ where: { chat_room_id: roomU1P1 } }),
    ).toBe(before);
  });

  it('QUOTE-AC-04 다른 작가의 상품 id로 새 견적을 보낸 응답과 견적 생성 여부를 기록', async () => {
    const before = await prisma.quotes.count({
      where: { chat_room_id: roomU1P1 },
    });
    const res = await sendQuote(p1.token, quoteBody({ productId: productP7 }));
    recorder.record('QUOTE-AC-04', {
      status: res.status,
      code: res.body.code ?? null,
      견적생성:
        (await prisma.quotes.count({ where: { chat_room_id: roomU1P1 } })) >
        before,
    });
  });

  it('QUOTE-AC-05 방 당사자가 아닌 계정으로 GET /quotes/{id}면 403 CHAT_ROOM_ACCESS_DENIED', async () => {
    const sent = (await sendQuote(p1.token, quoteBody())).body;
    for (const token of [u3.token, p7.token]) {
      const res = await getQuote(sent.id, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CHAT_ROOM_ACCESS_DENIED');
    }
  });
});
