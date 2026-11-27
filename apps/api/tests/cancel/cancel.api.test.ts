/**
 * CANCEL QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - 채팅 안내 카드는 SYSTEM 메시지의 payload.type으로 확인한다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReservationStatus } from '../../src/generated/prisma/enums.js';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder } from '../helpers.js';
import {
  DAY_MS,
  createPhotographerAccount,
  createReservationRecord,
  createUserAccount,
} from '../fixtures.js';

const recorder = createRecorder('CANCEL BE · AC');

let u1: Awaited<ReturnType<typeof createUserAccount>>;
let u3: Awaited<ReturnType<typeof createUserAccount>>;
let p1: Awaited<ReturnType<typeof createPhotographerAccount>>;
let p7: Awaited<ReturnType<typeof createPhotographerAccount>>;

beforeAll(async () => {
  u1 = await createUserAccount('QA취소U1');
  u3 = await createUserAccount('QA취소U3');
  p1 = await createPhotographerAccount('QA취소P1');
  p7 = await createPhotographerAccount('QA취소P7');
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

/** U1–P1 예약 (채팅방·견적 포함) */
const reserve = (status: ReservationStatus = 'CONFIRMED') =>
  createReservationRecord({
    userId: u1.userId,
    photographerId: p1.photographerId,
    status,
    createdAt: new Date(Date.now() - DAY_MS),
    shootAt: new Date(Date.now() + 20 * DAY_MS),
  });

const requestCancel = (
  reservationId: string,
  token: string | null,
  reason: unknown = 'QA 일정 변경',
) => {
  const req = api()
    .post(`/me/reservations/${reservationId}/cancel`)
    .send({ reason });
  return token ? req.set(bearer(token)) : req;
};

const processCancel = (
  reservationId: string,
  cancelRequestId: string,
  token: string | null,
  body: Record<string, unknown>,
) => {
  const req = api()
    .patch(`/me/reservations/${reservationId}/cancel/${cancelRequestId}`)
    .send(body);
  return token ? req.set(bearer(token)) : req;
};

const reservationStatus = async (id: string) =>
  (
    await prisma.reservations.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })
  ).status;

/** 예약에 남은 채팅 안내 카드 종류 (오래된 순) */
const chatCards = async (reservationId: string) =>
  (
    await prisma.chat_messages.findMany({
      where: { reservation_id: reservationId, message_type: 'SYSTEM' },
      orderBy: { created_at: 'asc' },
      select: { payload: true },
    })
  ).map(({ payload }) => (payload as { type?: string } | null)?.type);

const detail = async (reservationId: string, token: string) =>
  (await api().get(`/me/reservations/${reservationId}`).set(bearer(token)))
    .body;

// ---------------------------------------------------------------------------
describe('CANCEL BE · 취소 요청 POST /me/reservations/{id}/cancel', () => {
  it('CANCEL-BE-01 일반 토큰이면 요청이 PENDING으로 만들어지고 예약은 예약 확정 그대로다', async () => {
    const reservation = await reserve();
    const res = await requestCancel(reservation.id, u1.token);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      reason: 'QA 일정 변경',
    });
    expect(await reservationStatus(reservation.id)).toBe('CONFIRMED');
  });

  it('CANCEL-BE-R1 요청하면 작가 쪽 상세·목록에 취소 요청 중이 보이고 채팅에 요청 카드가 생긴다 (L2-01)', async () => {
    const reservation = await reserve();
    await requestCancel(reservation.id, u1.token);

    const asPhotographer = await detail(reservation.id, p1.token);
    expect(asPhotographer.cancelRequest).toMatchObject({
      status: 'PENDING',
      userReason: 'QA 일정 변경',
      requestedByMe: false,
    });
    expect(asPhotographer.canRequestCancel).toBe(false);

    const list = (
      await api().get('/me/reservations?pageSize=50').set(bearer(p1.token))
    ).body;
    const item = list.items.find(
      (row: { reservationId: string }) => row.reservationId === reservation.id,
    );
    expect(item.cancelRequestStatus).toBe('PENDING');

    expect(await chatCards(reservation.id)).toEqual([
      'RESERVATION_CANCEL_REQUESTED',
    ]);
  });

  it('CANCEL-BE-02 작가 토큰이면 요청이 ACCEPTED로 만들어지고 예약이 CANCELED가 된다 (L2-05)', async () => {
    const reservation = await reserve();
    const res = await requestCancel(reservation.id, p1.token, 'QA 작가 사정');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACCEPTED');
    expect(await reservationStatus(reservation.id)).toBe('CANCELED');
    expect(await chatCards(reservation.id)).toEqual(['RESERVATION_CANCELED']);

    // 양쪽 취소 탭에 보인다
    for (const token of [u1.token, p1.token]) {
      const canceled = (
        await api()
          .get('/me/reservations?type=CANCELED&pageSize=50')
          .set(bearer(token))
      ).body;
      expect(
        canceled.items.map(
          (row: { reservationId: string }) => row.reservationId,
        ),
      ).toContain(reservation.id);
    }
  });

  it.each([
    ['공백뿐', '   '],
    ['1,001자', '가'.repeat(1001)],
  ])(
    'CANCEL-BE-03 사유가 %s이면 400 VALIDATION_FAILED',
    async (_label, reason) => {
      const reservation = await reserve();
      const res = await requestCancel(reservation.id, u1.token, reason);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it('CANCEL-BE-03b 사유 1,000자는 받는다', async () => {
    const reservation = await reserve();
    const res = await requestCancel(
      reservation.id,
      u1.token,
      '가'.repeat(1000),
    );
    expect(res.status).toBe(201);
  });

  it('CANCEL-BE-04 이미 처리 대기 중인 요청이 있으면 409 CANCEL_REQUEST_ALREADY_PENDING', async () => {
    const reservation = await reserve();
    const first = await requestCancel(reservation.id, u1.token);
    const again = await requestCancel(reservation.id, u1.token);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('CANCEL_REQUEST_ALREADY_PENDING');
    expect(again.body.details).toEqual({
      cancelRequestId: first.body.cancelRequestId,
    });
  });

  it.each(['DELIVERED', 'PURCHASE_CONFIRMED', 'CANCELED'] as const)(
    'CANCEL-BE-05 %s 상태면 409 RESERVATION_NOT_CANCELABLE',
    async (status) => {
      const reservation = await reserve(status);
      for (const token of [u1.token, p1.token]) {
        const res = await requestCancel(reservation.id, token);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('RESERVATION_NOT_CANCELABLE');
      }
    },
  );

  it('CANCEL-BE-05b 촬영 완료 상태에서 요청한 응답을 기록', async () => {
    const asUser = await requestCancel(
      (await reserve('SHOOT_COMPLETED')).id,
      u1.token,
    );
    const asPhotographerReservation = await reserve('SHOOT_COMPLETED');
    const asPhotographer = await requestCancel(
      asPhotographerReservation.id,
      p1.token,
    );
    recorder.record('CANCEL-BE-05', {
      일반: `${asUser.status} ${asUser.body.status ?? asUser.body.code}`,
      작가: `${asPhotographer.status} ${asPhotographer.body.status ?? asPhotographer.body.code} → 예약 ${await reservationStatus(asPhotographerReservation.id)}`,
    });
  });
});

// ---------------------------------------------------------------------------
describe('CANCEL BE · 확정 · 반려 PATCH /me/reservations/{id}/cancel/{requestId}', () => {
  async function pendingRequest(status: ReservationStatus = 'CONFIRMED') {
    const reservation = await reserve(status);
    if (status !== 'CONFIRMED') {
      // TD-6: 요청 중인 채로 촬영 완료가 된 경우처럼, 상태를 먼저 두고 요청을 DB로 만든다
      const request = await prisma.reservation_cancel_requests.create({
        data: {
          reservation_id: reservation.id,
          requested_by_account_id: u1.accountId,
          reason: 'QA 일정 변경',
          status: 'PENDING',
        },
      });
      return { reservationId: reservation.id, cancelRequestId: request.id };
    }
    const res = await requestCancel(reservation.id, u1.token);
    return {
      reservationId: reservation.id,
      cancelRequestId: res.body.cancelRequestId as string,
    };
  }

  it.each([
    ['ACCEPTED인데 사유 없음', { status: 'ACCEPTED' }],
    ['ACCEPTED인데 사유가 공백', { status: 'ACCEPTED', reason: '  ' }],
    ['status가 다른 값', { status: 'NOPE' }],
  ])('CANCEL-BE-06 %s이면 400 VALIDATION_FAILED', async (_label, body) => {
    const { reservationId, cancelRequestId } = await pendingRequest();
    const res = await processCancel(
      reservationId,
      cancelRequestId,
      p1.token,
      body,
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('CANCEL-BE-R2 확정하면 예약 취소가 되고 상세에 사유·처리 시각이, 채팅에 취소 카드가 생긴다 (L2-02)', async () => {
    const { reservationId, cancelRequestId } = await pendingRequest();
    const res = await processCancel(reservationId, cancelRequestId, p1.token, {
      status: 'ACCEPTED',
      reason: 'QA 고객 요청 확인',
    });
    expect(res.status).toBe(200);
    expect(await reservationStatus(reservationId)).toBe('CANCELED');

    for (const token of [u1.token, p1.token]) {
      const body = await detail(reservationId, token);
      expect(body.cancelRequest).toMatchObject({
        status: 'ACCEPTED',
        userReason: 'QA 일정 변경',
        photographerReason: 'QA 고객 요청 확인',
        processedAt: expect.any(String),
      });
    }
    expect(await chatCards(reservationId)).toEqual([
      'RESERVATION_CANCEL_REQUESTED',
      'RESERVATION_CANCELED',
    ]);
  });

  it('CANCEL-BE-R3 반려하면 예약 확정이 유지되고 채팅에 반려 카드가 생기며, 다시 요청할 수 있다 (L2-03, L2-04)', async () => {
    const { reservationId, cancelRequestId } = await pendingRequest();
    const res = await processCancel(reservationId, cancelRequestId, p1.token, {
      status: 'REJECTED',
    });
    expect(res.status).toBe(200);
    expect(await reservationStatus(reservationId)).toBe('CONFIRMED');
    const body = await detail(reservationId, u1.token);
    expect(body.cancelRequest.status).toBe('REJECTED');
    expect(body.canRequestCancel).toBe(true);
    expect(await chatCards(reservationId)).toEqual([
      'RESERVATION_CANCEL_REQUESTED',
      'RESERVATION_CANCEL_REJECTED',
    ]);

    const again = await requestCancel(reservationId, u1.token, 'QA 다시 요청');
    expect(again.status).toBe(201);
    expect(again.body.status).toBe('PENDING');
  });

  it('CANCEL-BE-R4 요청 중인 채로 촬영 완료가 된 예약도 확정하면 예약 취소가 된다 (L1-13, TD-6)', async () => {
    const { reservationId, cancelRequestId } =
      await pendingRequest('SHOOT_COMPLETED');
    const res = await processCancel(reservationId, cancelRequestId, p1.token, {
      status: 'ACCEPTED',
      reason: 'QA 확정',
    });
    expect(res.status).toBe(200);
    expect(await reservationStatus(reservationId)).toBe('CANCELED');
  });

  it('CANCEL-BE-07 이미 처리된 요청을 다시 처리하면 409 CANCEL_REQUEST_ALREADY_PROCESSED', async () => {
    const { reservationId, cancelRequestId } = await pendingRequest();
    await processCancel(reservationId, cancelRequestId, p1.token, {
      status: 'REJECTED',
    });
    for (const body of [
      { status: 'REJECTED' },
      { status: 'ACCEPTED', reason: 'QA' },
    ]) {
      const res = await processCancel(
        reservationId,
        cancelRequestId,
        p1.token,
        body,
      );
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CANCEL_REQUEST_ALREADY_PROCESSED');
    }
  });

  it('CANCEL-BE-08 없는 요청 id면 404 CANCEL_REQUEST_NOT_FOUND', async () => {
    const reservation = await reserve();
    const res = await processCancel(reservation.id, randomUUID(), p1.token, {
      status: 'REJECTED',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CANCEL_REQUEST_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
describe('CANCEL BE · 동시 처리 · 반영 (L2)', () => {
  it('CANCEL-BE-R5 같은 요청을 동시에 확정·반려하면 먼저 처리된 것만 남고 늦은 쪽은 409 (L2-09)', async () => {
    const reservation = await reserve();
    const { cancelRequestId } = (await requestCancel(reservation.id, u1.token))
      .body;
    const [accept, reject] = await Promise.all([
      processCancel(reservation.id, cancelRequestId, p1.token, {
        status: 'ACCEPTED',
        reason: 'QA',
      }),
      processCancel(reservation.id, cancelRequestId, p1.token, {
        status: 'REJECTED',
      }),
    ]);
    const statuses = [accept.status, reject.status].sort();
    expect(statuses).toEqual([200, 409]);
    const late = accept.status === 409 ? accept : reject;
    expect(late.body.code).toBe('CANCEL_REQUEST_ALREADY_PROCESSED');

    const request = await prisma.reservation_cancel_requests.findUniqueOrThrow({
      where: { id: cancelRequestId },
    });
    expect(await reservationStatus(reservation.id)).toBe(
      request.status === 'ACCEPTED' ? 'CANCELED' : 'CONFIRMED',
    );
    recorder.record('CANCEL-L2-09', { 먼저처리: request.status });
  });

  it('CANCEL-L2-08 일반 계정의 요청과 작가의 직접 취소가 동시에 오면 결과를 기록', async () => {
    const reservation = await reserve();
    const [byUser, byPhotographer] = await Promise.all([
      requestCancel(reservation.id, u1.token),
      requestCancel(reservation.id, p1.token, 'QA 작가 사정'),
    ]);
    recorder.record('CANCEL-L2-08', {
      일반: `${byUser.status} ${byUser.body.status ?? byUser.body.code}`,
      작가: `${byPhotographer.status} ${byPhotographer.body.status ?? byPhotographer.body.code}`,
      예약: await reservationStatus(reservation.id),
      요청수: await prisma.reservation_cancel_requests.count({
        where: { reservation_id: reservation.id },
      }),
    });
  });

  it('CANCEL-L2-10 고객이 요청한 뒤 작가가 [예약 취소](직접 취소)를 누른 응답을 기록', async () => {
    const reservation = await reserve();
    await requestCancel(reservation.id, u1.token);
    const res = await requestCancel(reservation.id, p1.token, 'QA 작가 사정');
    recorder.record('CANCEL-L2-10', {
      status: res.status,
      code: res.body.code,
      예약: await reservationStatus(reservation.id),
    });
  });

  it('CANCEL-L2-06 취소된 예약의 견적으로 결제를 준비한 응답을 기록', async () => {
    const reservation = await reserve();
    await requestCancel(reservation.id, p1.token, 'QA 작가 사정');
    const res = await api()
      .post('/payments')
      .set(bearer(u1.token))
      .send({ quoteId: reservation.quote_id });
    recorder.record('CANCEL-L2-06', {
      status: res.status,
      code: res.body.code,
    });
  });

  it('CANCEL-L2-07 취소할 때 토스 환불 요청이 나가는지 기록', async () => {
    const reservation = await reserve();
    // 요청을 막지 않고 토스로 나간 요청만 센다
    const spy = vi.spyOn(globalThis, 'fetch');
    try {
      await requestCancel(reservation.id, p1.token, 'QA 작가 사정');
      const tossCalls = spy.mock.calls.filter(([input]) =>
        String(input instanceof Request ? input.url : input).includes(
          'tosspayments.com',
        ),
      );
      recorder.record('CANCEL-L2-07', { 토스요청수: tossCalls.length });
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
describe('CANCEL AC · 접근 제어', () => {
  it('CANCEL-AC-01 비회원이 취소 요청·확정·반려하면 401 UNAUTHORIZED', async () => {
    const reservation = await reserve();
    for (const res of [
      await requestCancel(reservation.id, null),
      await processCancel(reservation.id, randomUUID(), null, {
        status: 'REJECTED',
      }),
      await processCancel(reservation.id, randomUUID(), null, {
        status: 'ACCEPTED',
        reason: 'QA',
      }),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('CANCEL-AC-02 당사자가 아닌 일반·작가 계정이 취소 요청하면 404 RESERVATION_NOT_FOUND', async () => {
    const reservation = await reserve();
    for (const token of [u3.token, p7.token]) {
      const res = await requestCancel(reservation.id, token);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESERVATION_NOT_FOUND');
    }
    expect(await reservationStatus(reservation.id)).toBe('CONFIRMED');
  });

  it('CANCEL-AC-03 다른 작가가 남의 예약 요청을 확정·반려하면 404 RESERVATION_NOT_FOUND', async () => {
    const reservation = await reserve();
    const { cancelRequestId } = (await requestCancel(reservation.id, u1.token))
      .body;
    for (const body of [
      { status: 'REJECTED' },
      { status: 'ACCEPTED', reason: 'QA' },
    ]) {
      const res = await processCancel(
        reservation.id,
        cancelRequestId,
        p7.token,
        body,
      );
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESERVATION_NOT_FOUND');
    }
    expect(await reservationStatus(reservation.id)).toBe('CONFIRMED');
  });

  it('CANCEL-AC-04 일반 토큰으로 확정·반려 PATCH 응답 코드를 기록', async () => {
    const reservation = await reserve();
    const { cancelRequestId } = (await requestCancel(reservation.id, u1.token))
      .body;
    const res = await processCancel(reservation.id, cancelRequestId, u1.token, {
      status: 'REJECTED',
    });
    recorder.record('CANCEL-AC-04', {
      status: res.status,
      code: res.body.code,
    });
  });
});
