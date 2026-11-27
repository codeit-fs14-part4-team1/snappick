/**
 * PAY QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - 토스는 .env의 테스트 키로 실제 테스트 API를 호출한다
 * - 승인 성공은 결제창의 실제 paymentKey가 필요해 서버 테스트로 만들 수 없다
 *   그래서 승인 성공이 필요한 줄(BE-08·10·13)만 마지막 묶음에서 가짜 응답(toss-mock)을 쓴다
 * - 견적 데이터(TD)는 테스트마다 새 촬영 건으로 만든다. 결제하면 견적이 소진되기 때문
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder, tokenFor } from '../helpers.js';
import { mockToss } from '../toss-mock.js';

const recorder = createRecorder('PAY BE · AC');

const DAY_MS = 24 * 60 * 60 * 1000;

// 계정: 결제하는 일반 사용자(owner), 다른 일반 사용자(other), 견적을 보낸 작가
let owner = { userId: '', token: '' };
let other = { userId: '', token: '' };
let photographer = { id: '', token: '' };

beforeAll(async () => {
  const users = await prisma.users.findMany({
    select: { id: true, auth_account_id: true },
    orderBy: { id: 'asc' },
    take: 2,
  });
  owner = {
    userId: users[0]!.id,
    token: await tokenFor(users[0]!.auth_account_id),
  };
  other = {
    userId: users[1]!.id,
    token: await tokenFor(users[1]!.auth_account_id),
  };
  const found = await prisma.photographers.findFirstOrThrow({
    select: { id: true, auth_account_id: true },
    orderBy: { id: 'asc' },
  });
  photographer = { id: found.id, token: await tokenFor(found.auth_account_id) };
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

/**
 * owner와 작가의 채팅방에 새 촬영 건을 만들고 견적을 versions개 발행한다
 * 마지막 버전이 최신 견적
 */
async function createQuoteCase(
  options: {
    price?: number;
    shootAt?: Date;
    versions?: number;
    userId?: string;
  } = {},
) {
  const {
    price = 150_000,
    shootAt = new Date(Date.now() + 30 * DAY_MS),
    versions = 1,
    userId = owner.userId,
  } = options;
  const room = await prisma.chat_rooms.upsert({
    where: {
      user_id_photographer_id: {
        user_id: userId,
        photographer_id: photographer.id,
      },
    },
    create: { user_id: userId, photographer_id: photographer.id },
    update: {},
  });
  const shootingCase = await prisma.shooting_cases.create({
    data: { chat_room_id: room.id },
  });
  const quotes = [];
  for (let version = 1; version <= versions; version++) {
    quotes.push(
      await prisma.quotes.create({
        data: {
          chat_room_id: room.id,
          shooting_case_id: shootingCase.id,
          photographer_id: photographer.id,
          quote_name: `QA 견적 v${version}`,
          version,
          shoot_at: shootAt,
          location: '서울 성수동',
          location_lat: 37.54,
          location_lng: 127.05,
          duration_minutes: 120,
          price,
          photo_count: 30,
          includes_original: true,
        },
      }),
    );
  }
  return {
    roomId: room.id,
    shootingCaseId: shootingCase.id,
    quotes,
    latest: quotes.at(-1)!,
  };
}

const prepare = (quoteId: string, token = owner.token) =>
  api().post('/payments').set(bearer(token)).send({ quoteId });

const confirm = (
  body: { paymentKey: string; orderId: string; amount: number },
  token = owner.token,
) => api().post('/payments/confirm').set(bearer(token)).send(body);

/** 작가가 같은 촬영 건에 재견적을 보낸다 (POST /quotes) */
const requote = (
  roomId: string,
  shootingCaseId: string,
  expectedVersion: number,
) =>
  api()
    .post('/quotes')
    .set(bearer(photographer.token))
    .send({
      chatRoomId: roomId,
      shootingCaseId,
      expectedVersion,
      quoteName: 'QA 재견적',
      shootAt: new Date(Date.now() + 40 * DAY_MS).toISOString(),
      location: '서울 성수동',
      locationLat: 37.54,
      locationLng: 127.05,
      durationMinutes: 120,
      price: 160_000,
      photoCount: 30,
      includesOriginal: true,
    });

const reservationCount = (quoteId: string) =>
  prisma.reservations.count({ where: { quote_id: quoteId } });

// ---------------------------------------------------------------------------
describe('PAY BE · 결제 준비 POST /payments', () => {
  it('PAY-BE-01 최신 견적이면 orderId와 견적과 같은 금액이 온다', async () => {
    const { latest } = await createQuoteCase({ price: 150_000 });
    const res = await prepare(latest.id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'READY', amount: 150_000 });
    expect(res.body.orderId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('PAY-BE-01b 결제 준비 중인 견적을 다시 부르면 같은 orderId로 200이 온다', async () => {
    const { latest } = await createQuoteCase();
    const first = await prepare(latest.id);
    const second = await prepare(latest.id);
    expect(second.status).toBe(200);
    expect(second.body.orderId).toBe(first.body.orderId);
    expect(
      await prisma.payments.count({ where: { quote_id: latest.id } }),
    ).toBe(1);
  });

  it('PAY-BE-01c 0원 견적이면 orderId 없이 201, SUCCEEDED, reservationId가 온다', async () => {
    const { latest } = await createQuoteCase({ price: 0 });
    const res = await prepare(latest.id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUCCEEDED');
    expect(res.body).not.toHaveProperty('orderId');
    expect(res.body.reservationId).toBeTruthy();
    expect(await reservationCount(latest.id)).toBe(1);
    // 토스를 거치지 않으므로 결제 키가 없다
    const payment = await prisma.payments.findFirstOrThrow({
      where: { quote_id: latest.id },
    });
    expect(payment).toMatchObject({
      status: 'SUCCEEDED',
      pg_payment_id: null,
      amount: 0,
    });
  });

  it('PAY-BE-02 이전 버전 견적이면 409 QUOTE_NOT_LATEST', async () => {
    const { quotes } = await createQuoteCase({ versions: 2 });
    const res = await prepare(quotes[0]!.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('QUOTE_NOT_LATEST');
  });

  it('PAY-BE-03 이미 예약이 생긴 견적이면 409 QUOTE_ALREADY_RESERVED', async () => {
    const { latest } = await createQuoteCase({ price: 0 });
    await prepare(latest.id);
    const res = await prepare(latest.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('QUOTE_ALREADY_RESERVED');
  });

  it('PAY-BE-04 같은 촬영 건에 진행 중 예약이 있으면 409 ACTIVE_RESERVATION_EXISTS', async () => {
    // 예약이 생긴 촬영 건은 재견적이 막혀 있어 DB로 직접 만든다 (QA 문서와 같음)
    const { quotes } = await createQuoteCase({ versions: 2 });
    const v1 = quotes[0]!;
    await prisma.reservations.create({
      data: {
        quote_id: v1.id,
        user_id: owner.userId,
        photographer_id: photographer.id,
        status: 'CONFIRMED',
        shoot_at: v1.shoot_at,
        location: v1.location,
        total_amount: v1.price,
      },
    });
    const res = await prepare(quotes[1]!.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACTIVE_RESERVATION_EXISTS');
  });

  it('PAY-BE-05 UUID가 아니면 400 VALIDATION_FAILED, 없는 견적이면 404 QUOTE_NOT_FOUND', async () => {
    const invalid = await prepare('not-a-uuid');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    const missing = await prepare(randomUUID());
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('QUOTE_NOT_FOUND');
  });

  it('PAY-BE-12 촬영 일시가 지난 견적이면 409 QUOTE_EXPIRED', async () => {
    const { latest } = await createQuoteCase({
      shootAt: new Date(Date.now() - DAY_MS),
    });
    const res = await prepare(latest.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('QUOTE_EXPIRED');
  });
});

// ---------------------------------------------------------------------------
describe('PAY BE · 결제 승인 POST /payments/confirm', () => {
  it('PAY-BE-06 준비한 금액과 다른 amount면 400 PAYMENT_AMOUNT_MISMATCH', async () => {
    const { latest } = await createQuoteCase({ price: 150_000 });
    const { orderId } = (await prepare(latest.id)).body;
    const res = await confirm({
      paymentKey: 'pk_be06',
      orderId,
      amount: 149_000,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PAYMENT_AMOUNT_MISMATCH');
  });

  it('PAY-BE-07 없는 orderId면 404 PAYMENT_NOT_FOUND', async () => {
    const res = await confirm({
      paymentKey: 'pk_be07',
      orderId: randomUUID(),
      amount: 1000,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PAYMENT_NOT_FOUND');
  });

  it('PAY-BE-R1 결제창 없이 승인하면 실제 토스가 거절하고 409 PAYMENT_RETRY_REQUIRED, 결제는 FAILED로 남는다', async () => {
    const { latest } = await createQuoteCase();
    const { orderId, amount } = (await prepare(latest.id)).body;
    const paymentKey = `qa_no_session_${Date.now()}`;
    const res = await confirm({ paymentKey, orderId, amount });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_RETRY_REQUIRED');
    const payment = await prisma.payments.findUniqueOrThrow({
      where: { pg_order_id: orderId },
    });
    expect(payment.status).toBe('FAILED');
    recorder.record('PAY-BE-R1', { 토스오류코드: payment.failure_code });
    expect(await reservationCount(latest.id)).toBe(0);
  });

  it('PAY-BE-09 실패로 끝난 결제를 승인하면 409 PAYMENT_RETRY_REQUIRED', async () => {
    // 토스 거절로 FAILED가 된 결제를 DB로 만든다
    const { latest } = await createQuoteCase();
    const { orderId, amount } = (await prepare(latest.id)).body;
    await prisma.payments.update({
      where: { pg_order_id: orderId },
      data: { status: 'FAILED', failure_code: 'REJECT_CARD_PAYMENT' },
    });
    const res = await confirm({ paymentKey: 'pk_be09', orderId, amount });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_RETRY_REQUIRED');
  });

  it('PAY-BE-11 승인 직전에 재견적이 나간 결제를 승인하면 409 QUOTE_NOT_LATEST', async () => {
    const { roomId, shootingCaseId, latest } = await createQuoteCase();
    const { orderId, amount } = (await prepare(latest.id)).body;
    const sent = await requote(roomId, shootingCaseId, latest.version);
    expect(sent.status).toBeLessThan(300);
    const res = await confirm({ paymentKey: 'pk_be11', orderId, amount });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('QUOTE_NOT_LATEST');
    expect(await reservationCount(latest.id)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('PAY AC · 접근 제어', () => {
  it('PAY-AC-01 비회원이 POST /payments · /payments/confirm이면 401 UNAUTHORIZED', async () => {
    for (const res of [
      await api().post('/payments').send({ quoteId: randomUUID() }),
      await api()
        .post('/payments/confirm')
        .send({ paymentKey: 'pk', orderId: randomUUID(), amount: 1000 }),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('PAY-AC-02 작가 토큰으로 POST /payments 응답 코드를 기록', async () => {
    const { latest } = await createQuoteCase();
    const res = await prepare(latest.id, photographer.token);
    recorder.record('PAY-AC-02', { status: res.status, code: res.body.code });
  });

  it('PAY-AC-03 다른 일반 계정의 견적이면 403 QUOTE_ACCESS_DENIED', async () => {
    const { latest } = await createQuoteCase({ userId: owner.userId });
    const res = await prepare(latest.id, other.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('QUOTE_ACCESS_DENIED');
  });

  it('PAY-AC-04 다른 계정의 orderId로 승인하면 403 PAYMENT_ACCESS_DENIED', async () => {
    const { latest } = await createQuoteCase({ userId: owner.userId });
    const { orderId, amount } = (await prepare(latest.id)).body;
    const res = await confirm(
      { paymentKey: 'pk_ac04', orderId, amount },
      other.token,
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PAYMENT_ACCESS_DENIED');
  });
});

// ---------------------------------------------------------------------------
// 승인 성공이 필요한 줄: 실제 paymentKey는 토스 결제창(브라우저)에서만 나온다
// 그래서 이 묶음만 토스 응답을 가짜로 바꾼다 (실제 결제창 흐름은 L1·L2에서 확인)
describe('PAY BE · 승인 성공 (토스 가짜 응답)', () => {
  let toss: ReturnType<typeof mockToss>;
  beforeAll(() => {
    toss = mockToss();
  });
  afterAll(() => {
    toss.restore();
  });

  it('PAY-BE-08 승인된 결제에 다른 paymentKey를 보내면 409 PAYMENT_KEY_MISMATCH', async () => {
    const { latest } = await createQuoteCase({ price: 150_000 });
    const { orderId, amount } = (await prepare(latest.id)).body;
    const approved = await confirm({ paymentKey: 'pk_be08', orderId, amount });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('SUCCEEDED');
    // 토스 승인 요청에 견적 금액이 그대로 실렸는지 (L2-04의 서버 쪽)
    expect(
      toss.calls.find(({ body }) => body?.orderId === orderId)?.body?.amount,
    ).toBe(150_000);

    const res = await confirm({ paymentKey: 'pk_other', orderId, amount });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_KEY_MISMATCH');
  });

  it('PAY-BE-10 승인된 결제를 같은 값으로 한 번 더 승인한 응답과 예약 수를 기록', async () => {
    const { latest } = await createQuoteCase();
    const { orderId, amount } = (await prepare(latest.id)).body;
    const body = { paymentKey: 'pk_be10', orderId, amount };
    const first = await confirm(body);
    const second = await confirm(body);
    expect(first.status).toBe(200);
    recorder.record('PAY-BE-10', {
      status: second.status,
      body: second.body,
      예약수: await reservationCount(latest.id),
    });
  });

  it('PAY-BE-13 승인 중(PENDING)에는 재견적이 거절되고, 승인 후 시작한 견적으로 예약·확정 메시지가 1건씩 생긴다', async () => {
    const { roomId, shootingCaseId, latest } = await createQuoteCase();
    const { orderId, amount } = (await prepare(latest.id)).body;
    // 승인 요청을 보낸 직후 상태: PENDING + paymentKey 저장, 토스에서는 이미 승인됨
    const paymentKey = 'pk_be13';
    await prisma.payments.update({
      where: { pg_order_id: orderId },
      data: { status: 'PENDING', pg_payment_id: paymentKey },
    });
    toss.preset({ paymentKey, orderId, amount });

    const rejected = await requote(roomId, shootingCaseId, latest.version);
    expect(rejected.status).toBe(409);
    expect(rejected.body.code).toBe('PAYMENT_IN_PROGRESS');
    const maxVersion = await prisma.quotes.aggregate({
      where: { shooting_case_id: shootingCaseId },
      _max: { version: true },
    });
    expect(maxVersion._max.version).toBe(latest.version);

    const approved = await confirm({ paymentKey, orderId, amount });
    expect(approved.status).toBe(200);
    const reservations = await prisma.reservations.findMany({
      where: { quote: { shooting_case_id: shootingCaseId } },
      select: { id: true, quote_id: true },
    });
    expect(reservations).toHaveLength(1);
    expect(reservations[0]!.quote_id).toBe(latest.id);
    expect(
      await prisma.chat_messages.count({
        where: { reservation_id: reservations[0]!.id, message_type: 'SYSTEM' },
      }),
    ).toBe(1);
  });
});
