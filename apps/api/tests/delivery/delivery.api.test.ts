/**
 * DELIVERY QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - BE-P* 줄은 QA 문서 "추가 제안"의 줄이다. 문서 줄에서 파생한 정책 제안이라 정책이 정해지기 전까지 실패할 수 있다
 * - 자동 구매 확정(L2-06)은 10분 배치를 기다리지 않고 배치 함수에 기준 시각을 넣어 확인한다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReservationStatus } from '../../src/generated/prisma/enums.js';
import { prisma } from '../../src/lib/prisma.js';
import { advanceReservationStatuses } from '../../src/modules/reservations/reservations.service.js';
import { api, bearer, createRecorder } from '../helpers.js';
import {
  DAY_MS,
  createPhotographerAccount,
  createReservationRecord,
  createUserAccount,
} from '../fixtures.js';

const recorder = createRecorder('DELIVERY BE · AC');

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** 오늘(한국 날짜)에서 days일 뒤를 YYYY.MM.DD로 */
const kstDot = (days = 0) =>
  new Date(Date.now() + KST_OFFSET_MS + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', '.');

const VALID = {
  link: 'https://drive.example.com/qa-photos',
  expirationPeriod: kstDot(30),
  notice: 'QA 보정본 30장입니다',
};

let u1: Awaited<ReturnType<typeof createUserAccount>>;
let u3: Awaited<ReturnType<typeof createUserAccount>>;
let p1: Awaited<ReturnType<typeof createPhotographerAccount>>;
let p7: Awaited<ReturnType<typeof createPhotographerAccount>>;

beforeAll(async () => {
  u1 = await createUserAccount('QA전달U1');
  u3 = await createUserAccount('QA전달U3');
  p1 = await createPhotographerAccount('QA전달P1');
  p7 = await createPhotographerAccount('QA전달P7');
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

const reserve = (status: ReservationStatus = 'SHOOT_COMPLETED') =>
  createReservationRecord({
    userId: u1.userId,
    photographerId: p1.photographerId,
    status,
    createdAt: new Date(Date.now() - 20 * DAY_MS),
    shootAt: new Date(Date.now() - 3 * DAY_MS),
  });

const url = (id: string) => `/me/reservations/${id}/deliverable`;
const deliver = (
  id: string,
  token: string | null,
  body: Record<string, unknown> = VALID,
) => {
  const req = api().post(url(id)).send(body);
  return token ? req.set(bearer(token)) : req;
};
const editDeliverable = (
  id: string,
  token: string | null,
  body: Record<string, unknown>,
) => {
  const req = api().patch(url(id)).send(body);
  return token ? req.set(bearer(token)) : req;
};
const getDeliverable = (id: string, token: string | null) => {
  const req = api().get(url(id));
  return token ? req.set(bearer(token)) : req;
};
const confirmPurchase = (id: string, token: string | null) => {
  const req = api().patch(`/me/reservations/${id}/purchase-confirm`);
  return token ? req.set(bearer(token)) : req;
};

const statusOf = async (id: string) =>
  (
    await prisma.reservations.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })
  ).status;

/** 결과물 전달까지 마친 예약 (POST로 전달) */
async function delivered() {
  const reservation = await reserve();
  const res = await deliver(reservation.id, p1.token);
  expect(res.status).toBe(201);
  return reservation.id;
}

/** 전달 시각을 정해 DB로 만든 결과물 전달 예약 (자동 구매 확정용) */
async function deliveredAt(createdAt: Date) {
  const reservation = await reserve('DELIVERED');
  await prisma.deliverables.create({
    data: {
      reservation_id: reservation.id,
      link: VALID.link,
      expiration_period: new Date(Date.now() + 30 * DAY_MS),
      created_at: createdAt,
    },
  });
  return reservation.id;
}

const listIds = async (token: string, type: string) =>
  (
    await api()
      .get(`/me/reservations?type=${type}&pageSize=50`)
      .set(bearer(token))
  ).body.items.map((row: { reservationId: string }) => row.reservationId);

// ---------------------------------------------------------------------------
describe('DELIVERY BE · 결과물 /me/reservations/{id}/deliverable', () => {
  it('DELIVERY-BE-01 촬영 완료 예약에 POST하면 결과물이 만들어지고 예약이 DELIVERED가 된다', async () => {
    const reservation = await reserve();
    const res = await deliver(reservation.id, p1.token);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ...VALID,
      reservationStatus: 'DELIVERED',
    });
    expect(await statusOf(reservation.id)).toBe('DELIVERED');
  });

  it('DELIVERY-BE-R1 전달하면 양쪽 목록 진행 탭에 있고 채팅에 결과물 카드가 생기며, 일반 계정이 결과물을 본다 (L2-01, L1-09)', async () => {
    const id = await delivered();
    for (const token of [u1.token, p1.token]) {
      expect(await listIds(token, 'IN_PROGRESS')).toContain(id);
    }
    const cards = await prisma.chat_messages.findMany({
      where: { reservation_id: id, message_type: 'SYSTEM' },
      select: { payload: true },
    });
    expect(
      cards.map(({ payload }) => (payload as { type: string }).type),
    ).toEqual(['RESERVATION_DELIVERED']);
    const seen = await getDeliverable(id, u1.token);
    expect(seen.status).toBe(200);
    expect(seen.body).toMatchObject(VALID);
  });

  it('DELIVERY-BE-02a 이미 결과물이 있으면 409 DELIVERABLE_ALREADY_EXISTS (결과물 전달·구매 확정 상태)', async () => {
    const id = await delivered();
    const again = await deliver(id, p1.token);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('DELIVERABLE_ALREADY_EXISTS');

    await confirmPurchase(id, u1.token);
    const afterConfirm = await deliver(id, p1.token);
    expect(afterConfirm.status).toBe(409);
    expect(afterConfirm.body.code).toBe('DELIVERABLE_ALREADY_EXISTS');
  });

  it.each(['CONFIRMED', 'CANCELED'] as const)(
    'DELIVERY-BE-02b %s 상태면 409 RESERVATION_NOT_DELIVERABLE',
    async (status) => {
      const reservation = await reserve(status);
      const res = await deliver(reservation.id, p1.token);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('RESERVATION_NOT_DELIVERABLE');
    },
  );

  it('DELIVERY-BE-02c 취소 요청 중이면 409 CANCEL_REQUEST_PENDING (L1-01, TD-1)', async () => {
    const reservation = await reserve();
    const request = await prisma.reservation_cancel_requests.create({
      data: {
        reservation_id: reservation.id,
        requested_by_account_id: u1.accountId,
        reason: 'QA 취소 요청',
        status: 'PENDING',
      },
    });
    const res = await deliver(reservation.id, p1.token);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'CANCEL_REQUEST_PENDING',
      details: { cancelRequestId: request.id },
    });
    expect(await statusOf(reservation.id)).toBe('SHOOT_COMPLETED');
  });

  it.each([
    ['링크가 ftp', { link: 'ftp://example.com/a' }],
    ['링크가 주소 아님', { link: 'not-a-url' }],
    [
      '링크 2,001자',
      {
        link: `https://example.com/${'a'.repeat(2001 - 'https://example.com/'.length)}`,
      },
    ],
    [
      '유효 기간 형식이 틀림',
      { expirationPeriod: kstDot(30).replaceAll('.', '-') },
    ],
    ['유효 기간이 어제', { expirationPeriod: kstDot(-1) }],
    ['유효 기간이 없는 날짜', { expirationPeriod: '2027.02.30' }],
    ['안내 1,001자', { notice: '가'.repeat(1001) }],
  ])('DELIVERY-BE-03 %s면 400 VALIDATION_FAILED', async (_label, override) => {
    const reservation = await reserve();
    const res = await deliver(reservation.id, p1.token, {
      ...VALID,
      ...override,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(await statusOf(reservation.id)).toBe('SHOOT_COMPLETED');
  });

  it('DELIVERY-BE-03b 링크 2,000자, 유효 기간 오늘, 안내 1,000자·생략은 받는다', async () => {
    const long = `https://example.com/${'a'.repeat(2000 - 'https://example.com/'.length)}`;
    for (const body of [
      {
        ...VALID,
        link: long,
        expirationPeriod: kstDot(0),
        notice: '가'.repeat(1000),
      },
      { link: 'http://example.com/qa', expirationPeriod: kstDot(0) },
    ]) {
      const reservation = await reserve();
      const res = await deliver(reservation.id, p1.token, body);
      expect(res.status).toBe(201);
      expect(res.body.expirationPeriod).toBe(body.expirationPeriod);
    }
  });

  it('DELIVERY-BE-04 PATCH에 바꿀 값이 없으면 400, 결과물이 없는 예약이면 404 DELIVERABLE_NOT_FOUND', async () => {
    const id = await delivered();
    const empty = await editDeliverable(id, p1.token, {});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('VALIDATION_FAILED');

    const none = await reserve();
    const missing = await editDeliverable(none.id, p1.token, { notice: 'QA' });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('DELIVERABLE_NOT_FOUND');
  });

  it('DELIVERY-BE-R2 결과물을 수정하면 일반 계정에 고친 값이 보이고, 처음 전달 시각은 그대로다 (L2-03)', async () => {
    const id = await delivered();
    const before = (await getDeliverable(id, u1.token)).body;
    const res = await editDeliverable(id, p1.token, {
      link: 'https://drive.example.com/qa-photos-v2',
      expirationPeriod: kstDot(40),
      notice: null,
    });
    expect(res.status).toBe(200);
    const after = (await getDeliverable(id, u1.token)).body;
    expect(after).toMatchObject({
      link: 'https://drive.example.com/qa-photos-v2',
      expirationPeriod: kstDot(40),
      notice: null,
      createdAt: before.createdAt,
    });
  });

  it('DELIVERY-BE-05 구매 확정된 예약의 결과물을 PATCH한 응답과 수정 여부를 기록', async () => {
    const id = await delivered();
    await confirmPurchase(id, u1.token);
    const res = await editDeliverable(id, p1.token, {
      notice: 'QA 확정 뒤 수정',
    });
    const saved = await prisma.deliverables.findUniqueOrThrow({
      where: { reservation_id: id },
    });
    recorder.record('DELIVERY-BE-05', {
      status: res.status,
      code: res.body.code ?? null,
      수정됨: saved.notice === 'QA 확정 뒤 수정',
    });
  });

  it('DELIVERY-BE-R3 [DQ-01 실제 동작] 유효 기간이 지난 결과물도 그대로 조회된다 (L2-07)', async () => {
    const id = await delivered();
    await prisma.deliverables.update({
      where: { reservation_id: id },
      data: { expiration_period: new Date(Date.now() - 10 * DAY_MS) },
    });
    const res = await getDeliverable(id, u1.token);
    expect(res.status).toBe(200);
    expect(res.body.expirationPeriod).toBe(kstDot(-10));
  });
});

// ---------------------------------------------------------------------------
describe('DELIVERY BE · 구매 확정 PATCH /me/reservations/{id}/purchase-confirm', () => {
  it('DELIVERY-BE-06a 결과물 전달 상태면 구매 확정, 이미 확정이면 409 ALREADY_PURCHASE_CONFIRMED', async () => {
    const id = await delivered();
    const res = await confirmPurchase(id, u1.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      reservationId: id,
      status: 'PURCHASE_CONFIRMED',
      purchaseConfirmedAt: expect.any(String),
    });
    const again = await confirmPurchase(id, u1.token);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_PURCHASE_CONFIRMED');
  });

  it.each(['CONFIRMED', 'SHOOT_COMPLETED', 'CANCELED'] as const)(
    'DELIVERY-BE-06b %s 상태면 409 RESERVATION_NOT_CONFIRMABLE',
    async (status) => {
      const reservation = await reserve(status);
      const res = await confirmPurchase(reservation.id, u1.token);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('RESERVATION_NOT_CONFIRMABLE');
    },
  );

  it('DELIVERY-BE-R4 구매 확정하면 양쪽 완료 탭으로 옮겨지고 리뷰 작성 가능에 나온다 (L2-04)', async () => {
    const id = await delivered();
    await confirmPurchase(id, u1.token);
    for (const token of [u1.token, p1.token]) {
      expect(await listIds(token, 'COMPLETED')).toContain(id);
      expect(await listIds(token, 'IN_PROGRESS')).not.toContain(id);
    }
    const eligible = (
      await api().get('/me/reviews/eligible?pageSize=50').set(bearer(u1.token))
    ).body.items.map((row: { reservationId: string }) => row.reservationId);
    expect(eligible).toContain(id);
  });

  it('DELIVERY-BE-R5 구매 확정을 동시에 두 번 보내면 한 번만 확정되고 늦은 쪽은 409 (L2-09)', async () => {
    const id = await delivered();
    const results = await Promise.all([
      confirmPurchase(id, u1.token),
      confirmPurchase(id, u1.token),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(results.find(({ status }) => status === 409)?.body.code).toBe(
      'ALREADY_PURCHASE_CONFIRMED',
    );
  });

  it('DELIVERY-L2-08 결과물 수정과 구매 확정이 동시에 오면 결과를 기록', async () => {
    const id = await delivered();
    const [edit, confirm] = await Promise.all([
      editDeliverable(id, p1.token, { notice: 'QA 동시 수정' }),
      confirmPurchase(id, u1.token),
    ]);
    const saved = await prisma.deliverables.findUniqueOrThrow({
      where: { reservation_id: id },
    });
    recorder.record('DELIVERY-L2-08', {
      수정: `${edit.status} ${edit.body.code ?? ''}`.trim(),
      구매확정: `${confirm.status} ${confirm.body.code ?? ''}`.trim(),
      예약: await statusOf(id),
      '수정 반영': saved.notice === 'QA 동시 수정',
    });
  });
});

// ---------------------------------------------------------------------------
// QA 문서 "추가 제안": 구매 확정 뒤에는 결과물을 바꿀 수 없어야 한다 (정책 미정)
// 화면은 status === 'DELIVERED'일 때만 수정 버튼을 보여 주지만, 열어 둔 수정 폼이나 API 직접 호출은 막지 못한다
// 그래서 서버가 막는지를 본다 (오류 코드는 아직 정해지지 않아 상태 코드 409만 본다)
describe('DELIVERY BE · 추가 제안 (정책 미정)', () => {
  it('DELIVERY-BE-P1 구매 확정된 예약의 결과물 PATCH는 409이고 결과물은 그대로다 (BE-05·L1-12 파생, 정책 미정)', async () => {
    const id = await delivered();
    // 작가가 수정 폼을 연 시점의 결과물
    const before = (await getDeliverable(id, p1.token)).body;
    // 그사이 고객이 구매 확정
    expect((await confirmPurchase(id, u1.token)).status).toBe(200);

    const res = await editDeliverable(id, p1.token, {
      link: 'https://drive.example.com/qa-after-confirm',
      notice: 'QA 확정 뒤 수정',
    });
    expect(res.status).toBe(409);
    const after = (await getDeliverable(id, u1.token)).body;
    expect(after).toEqual(before);
  });

  it('DELIVERY-BE-P2 결과물 수정과 구매 확정이 동시에 와도 구매 확정 뒤에 반영된 수정이 없다 (L2-08 파생, 정책 미정)', async () => {
    const id = await delivered();
    const [edit] = await Promise.all([
      editDeliverable(id, p1.token, { notice: 'QA 동시 수정' }),
      confirmPurchase(id, u1.token),
    ]);
    const reservation = await prisma.reservations.findUniqueOrThrow({
      where: { id },
    });
    const saved = await prisma.deliverables.findUniqueOrThrow({
      where: { reservation_id: id },
    });
    expect(reservation.status).toBe('PURCHASE_CONFIRMED');

    if (edit.status === 200) {
      // 수정이 먼저 처리됐다면 구매 확정보다 앞선 시각이어야 한다
      expect(saved.updated_at.getTime()).toBeLessThanOrEqual(
        reservation.purchase_confirmed_at!.getTime(),
      );
    } else {
      // 구매 확정이 먼저 처리됐다면 수정은 거절되고 반영되지 않아야 한다
      expect(edit.status).toBe(409);
      expect(saved.notice).toBe(VALID.notice);
    }
  });
});

// ---------------------------------------------------------------------------
describe('DELIVERY BE · 자동 구매 확정 (배치 함수에 기준 시각을 넣어 확인)', () => {
  it('DELIVERY-BE-R6 전달한 지 8일이 지나면 구매 확정으로 바뀐다 (L2-06)', async () => {
    const deliveredTime = new Date(Date.now() - 9 * DAY_MS);
    const id = await deliveredAt(deliveredTime);

    await advanceReservationStatuses(
      new Date(deliveredTime.getTime() + 8 * DAY_MS - 60_000),
    );
    expect(await statusOf(id)).toBe('DELIVERED');

    const at = new Date(deliveredTime.getTime() + 8 * DAY_MS);
    await advanceReservationStatuses(at);
    const reservation = await prisma.reservations.findUniqueOrThrow({
      where: { id },
    });
    expect(reservation.status).toBe('PURCHASE_CONFIRMED');
    expect(reservation.purchase_confirmed_at?.getTime()).toBe(at.getTime());
  });

  it('DELIVERY-BE-R7 결과물을 수정해도 자동 구매 확정은 처음 전달 시각 기준이다', async () => {
    const deliveredTime = new Date(Date.now() - 9 * DAY_MS);
    const id = await deliveredAt(deliveredTime);
    await editDeliverable(id, p1.token, { notice: 'QA 수정' });
    await advanceReservationStatuses(new Date());
    expect(await statusOf(id)).toBe('PURCHASE_CONFIRMED');
  });
});

// ---------------------------------------------------------------------------
describe('DELIVERY AC · 접근 제어', () => {
  it('DELIVERY-AC-01 비회원이 결과물 조회·전달·수정, 구매 확정하면 401 UNAUTHORIZED', async () => {
    const id = await delivered();
    for (const res of [
      await getDeliverable(id, null),
      await deliver(id, null),
      await editDeliverable(id, null, { notice: 'QA' }),
      await confirmPurchase(id, null),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('DELIVERY-AC-02 일반 토큰으로 결과물 POST·PATCH 응답 코드를 기록', async () => {
    const shot = await reserve();
    const post = await deliver(shot.id, u1.token);
    const id = await delivered();
    const patch = await editDeliverable(id, u1.token, { notice: 'QA' });
    recorder.record('DELIVERY-AC-02', {
      POST: `${post.status} ${post.body.code}`,
      PATCH: `${patch.status} ${patch.body.code}`,
    });
  });

  it('DELIVERY-AC-03 작가 토큰으로 구매 확정한 응답 코드를 기록', async () => {
    const id = await delivered();
    const res = await confirmPurchase(id, p1.token);
    recorder.record('DELIVERY-AC-03', {
      status: res.status,
      code: res.body.code,
    });
  });

  it('DELIVERY-AC-04 다른 계정의 예약이면 결과물 조회·전달·수정·구매 확정 모두 404 RESERVATION_NOT_FOUND', async () => {
    const id = await delivered();
    const shot = await reserve();
    for (const res of [
      await getDeliverable(id, u3.token),
      await getDeliverable(id, p7.token),
      await deliver(shot.id, p7.token),
      await editDeliverable(id, p7.token, { notice: 'QA 남의 결과물' }),
      await confirmPurchase(id, u3.token),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESERVATION_NOT_FOUND');
    }
    expect(await statusOf(id)).toBe('DELIVERED');
    expect(await statusOf(shot.id)).toBe('SHOOT_COMPLETED');
  });

  it('DELIVERY-AC-04b 없는 예약 id면 404 RESERVATION_NOT_FOUND', async () => {
    const res = await getDeliverable(randomUUID(), u1.token);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESERVATION_NOT_FOUND');
  });
});
