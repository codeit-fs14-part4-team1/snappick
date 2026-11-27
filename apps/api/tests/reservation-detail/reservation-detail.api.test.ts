/**
 * RESVDETAIL QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - 자동 촬영 완료(BE-04)는 10분 배치를 기다리지 않고 배치 함수에 기준 시각을 넣어 확인한다
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
  createQuoteCase,
  createReservationRecord,
  createUserAccount,
} from '../fixtures.js';

const recorder = createRecorder('RESVDETAIL BE · AC');

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** 한국 시간으로 정한 시각 */
const kst = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min, s) - KST_OFFSET_MS);
/** 한국 날짜 YYYY-MM-DD */
const kstDateString = (date: Date) =>
  new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
/** 오늘(한국 날짜)에서 days일 뒤의 0시 */
function kstTodayStart(days = 0) {
  const now = new Date(Date.now() + KST_OFFSET_MS);
  return kst(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate() + days,
  );
}

let u1: Awaited<ReturnType<typeof createUserAccount>>;
let u3: Awaited<ReturnType<typeof createUserAccount>>;
let p1: Awaited<ReturnType<typeof createPhotographerAccount>>;
let p7: Awaited<ReturnType<typeof createPhotographerAccount>>;

const detail = (reservationId: string, token: string | null) => {
  const req = api().get(`/me/reservations/${reservationId}`);
  return token ? req.set(bearer(token)) : req;
};

const reserve = (
  status: ReservationStatus,
  shootAt = new Date(Date.now() + 20 * DAY_MS),
) =>
  createReservationRecord({
    userId: u1.userId,
    photographerId: p1.photographerId,
    status,
    createdAt: new Date(Date.now() - DAY_MS),
    shootAt,
  });

const status = async (id: string) =>
  (
    await prisma.reservations.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })
  ).status;

beforeAll(async () => {
  u1 = await createUserAccount('QA상세U1');
  u3 = await createUserAccount('QA상세U3');
  p1 = await createPhotographerAccount('QA상세P1');
  p7 = await createPhotographerAccount('QA상세P7');
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
describe('RESVDETAIL BE · 예약 상세 GET /me/reservations/{id}', () => {
  it('RESVDETAIL-BE-01 당사자 토큰이면 200과 상태·견적·결제·취소 요청·canRequestCancel·deliveryDueDate·locationCoords가 온다', async () => {
    const reservation = await reserve('CONFIRMED');
    for (const token of [u1.token, p1.token]) {
      const res = await detail(reservation.id, token);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        reservationId: reservation.id,
        status: 'CONFIRMED',
        quote: expect.objectContaining({ name: expect.any(String) }),
        payment: expect.objectContaining({ paymentProvider: 'TOSS' }),
        cancelRequest: null,
        canRequestCancel: true,
        deliveryDueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        locationCoords: { lat: expect.any(Number), lng: expect.any(Number) },
      });
      expect(res.body.reservationNumber).toMatch(
        /^SP-\d{6}-\d{6}-[0-9A-Z]{4}$/,
      );
    }
  });

  it('RESVDETAIL-BE-02 UUID가 아니면 400 VALIDATION_FAILED, 없는 예약이면 404 RESERVATION_NOT_FOUND', async () => {
    const invalid = await detail('not-a-uuid', u1.token);
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    const missing = await detail(randomUUID(), u1.token);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESERVATION_NOT_FOUND');
  });

  it.each([
    ['오후', kst(2026, 12, 10, 15, 0), '2026-12-24'],
    [
      '한국 23:30 (UTC로는 같은 날 14:30)',
      kst(2026, 12, 10, 23, 30),
      '2026-12-24',
    ],
    ['한국 00:30 (UTC로는 전날)', kst(2026, 12, 11, 0, 30), '2026-12-25'],
    ['월말을 넘김', kst(2026, 12, 20, 10, 0), '2027-01-03'],
  ])(
    'RESVDETAIL-BE-03 deliveryDueDate는 촬영일 다음 날부터 14일째 (%s)',
    async (_label, shootAt, expected) => {
      const reservation = await reserve('CONFIRMED', shootAt);
      const res = await detail(reservation.id, u1.token);
      expect(res.body.deliveryDueDate).toBe(expected);
      // 촬영일(한국 날짜) + 14일
      expect(res.body.deliveryDueDate).toBe(
        kstDateString(new Date(shootAt.getTime() + 14 * DAY_MS)),
      );
    },
  );

  it('RESVDETAIL-BE-R1 일반·작가 계정으로 열면 상대 정보만 다르고 나머지는 같다 (L1-08, L2-03)', async () => {
    const reservation = await reserve('CONFIRMED');
    const asUser = (await detail(reservation.id, u1.token)).body;
    const asPhotographer = (await detail(reservation.id, p1.token)).body;

    expect(asUser.photographer).toMatchObject({ nickname: p1.nickname });
    expect(asUser).not.toHaveProperty('user');
    expect(asPhotographer.user).toMatchObject({ nickname: u1.nickname });
    expect(asPhotographer).not.toHaveProperty('photographer');

    // 상대 정보 칸만 빼고 비교한다
    const without = (body: Record<string, unknown>, key: string) =>
      Object.fromEntries(Object.entries(body).filter(([k]) => k !== key));
    expect(without(asPhotographer, 'user')).toEqual(
      without(asUser, 'photographer'),
    );
  });

  it('RESVDETAIL-BE-R2 상세 값이 결제한 견적과 같다 (L2-04)', async () => {
    const reservation = await reserve('CONFIRMED');
    const quote = await prisma.quotes.findUniqueOrThrow({
      where: { id: reservation.quote_id! },
    });
    await prisma.quotes.update({
      where: { id: quote.id },
      data: {
        additional_notice: 'QA 추가 안내',
        common_notice: 'QA 공통 안내',
      },
    });
    const body = (await detail(reservation.id, u1.token)).body;
    expect(body).toMatchObject({
      shootAt: quote.shoot_at.toISOString(),
      location: quote.location,
      totalAmount: quote.price,
      durationMinutes: quote.duration_minutes,
      photoCount: quote.photo_count,
      locationCoords: { lat: quote.location_lat, lng: quote.location_lng },
      quote: {
        name: quote.quote_name,
        includesOriginal: quote.includes_original,
        additionalNotice: 'QA 추가 안내',
        commonNotice: 'QA 공통 안내',
        chatRoomId: quote.chat_room_id,
      },
    });
  });

  it('RESVDETAIL-BE-R3 견적 연결이 끊긴 예약은 locationCoords·quote가 null이다 (TD-2 좌표 없는 예약)', async () => {
    const reservation = await reserve('CONFIRMED');
    await prisma.reservations.update({
      where: { id: reservation.id },
      data: { quote_id: null },
    });
    const res = await detail(reservation.id, u1.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ locationCoords: null, quote: null });
  });

  it('RESVDETAIL-BE-R4 0원 예약의 결제 정보를 기록 (L1-07 "무료" 표시용)', async () => {
    const { latest } = await createQuoteCase({
      userId: u1.userId,
      photographerId: p1.photographerId,
      price: 0,
    });
    const prepared = await api()
      .post('/payments')
      .set(bearer(u1.token))
      .send({ quoteId: latest.id });
    expect(prepared.status).toBe(201);
    const body = (await detail(prepared.body.reservationId, u1.token)).body;
    expect(body.totalAmount).toBe(0);
    recorder.record('RESVDETAIL-BE-R4', {
      totalAmount: body.totalAmount,
      payment: body.payment,
    });
  });

  it.each([
    ['CONFIRMED', null, true],
    ['CONFIRMED', 'PENDING', false],
    ['CONFIRMED', 'REJECTED', true],
    ['SHOOT_COMPLETED', null, true],
    ['DELIVERED', null, false],
    ['PURCHASE_CONFIRMED', null, false],
  ] as const)(
    'RESVDETAIL-BE-R5 canRequestCancel: %s, 최근 취소 요청 %s → %s',
    async (reservationStatus, cancelStatus, expected) => {
      const reservation = await reserve(reservationStatus);
      if (cancelStatus) {
        await prisma.reservation_cancel_requests.create({
          data: {
            reservation_id: reservation.id,
            requested_by_account_id: u1.accountId,
            reason: 'QA 취소 요청',
            status: cancelStatus,
            ...(cancelStatus !== 'PENDING' && { processed_at: new Date() }),
          },
        });
      }
      const body = (await detail(reservation.id, u1.token)).body;
      expect(body.canRequestCancel).toBe(expected);
      expect(body.cancelRequest?.status ?? null).toBe(cancelStatus);
    },
  );

  it('RESVDETAIL-BE-R6 취소된 예약에는 취소 사유·처리 일시가 온다 (L1-11)', async () => {
    const reservation = await reserve('CANCELED');
    const processedAt = new Date(Date.now() - 60_000);
    await prisma.reservation_cancel_requests.create({
      data: {
        reservation_id: reservation.id,
        requested_by_account_id: u1.accountId,
        reason: 'QA 일정 변경',
        accept_reason: 'QA 수락 사유',
        status: 'ACCEPTED',
        processed_at: processedAt,
      },
    });
    for (const [token, requestedByMe] of [
      [u1.token, true],
      [p1.token, false],
    ] as const) {
      const body = (await detail(reservation.id, token)).body;
      expect(body).toMatchObject({
        status: 'CANCELED',
        canRequestCancel: false,
        cancelRequest: {
          status: 'ACCEPTED',
          userReason: 'QA 일정 변경',
          photographerReason: 'QA 수락 사유',
          requestedByMe,
          processedAt: processedAt.toISOString(),
        },
      });
    }
  });
});

// ---------------------------------------------------------------------------
describe('RESVDETAIL BE · 자동 촬영 완료 (배치 함수에 기준 시각을 넣어 확인)', () => {
  it('RESVDETAIL-BE-04 촬영일 다음 날 0시(한국 시간)가 지난 예약 확정이 촬영 완료로 바뀌는 시각을 기록', async () => {
    // 어제 오후 3시(한국 시간) 촬영
    const shootAt = new Date(kstTodayStart(-1).getTime() + 15 * 60 * 60 * 1000);
    const reservation = await reserve('CONFIRMED', shootAt);

    const beforeMidnight = new Date(kstTodayStart().getTime() - 1000);
    await advanceReservationStatuses(beforeMidnight);
    const statusBefore = await status(reservation.id);

    const midnight = kstTodayStart();
    await advanceReservationStatuses(midnight);
    const statusAfter = await status(reservation.id);

    expect(statusBefore).toBe('CONFIRMED');
    expect(statusAfter).toBe('SHOOT_COMPLETED');
    recorder.record('RESVDETAIL-BE-04', {
      촬영: `${kstDateString(shootAt)} 15:00`,
      '다음 날 0시 1초 전': statusBefore,
      '다음 날 0시': statusAfter,
    });
  });

  it('RESVDETAIL-BE-R7 촬영 당일에는 촬영 시각이 지나도 예약 확정 그대로다', async () => {
    // 오늘 0시 1분 촬영, 기준 시각은 오늘 23:59
    const shootAt = new Date(kstTodayStart().getTime() + 60_000);
    const reservation = await reserve('CONFIRMED', shootAt);
    await advanceReservationStatuses(
      new Date(kstTodayStart(1).getTime() - 60_000),
    );
    expect(await status(reservation.id)).toBe('CONFIRMED');
  });

  it('RESVDETAIL-BE-R8 [DQ-01 실제 동작] 취소 요청 중인 예약도 촬영일이 지나면 촬영 완료로 바뀌고 취소 요청은 그대로 남는다 (L2-06)', async () => {
    const shootAt = new Date(kstTodayStart(-1).getTime() + 15 * 60 * 60 * 1000);
    const reservation = await reserve('CONFIRMED', shootAt);
    await prisma.reservation_cancel_requests.create({
      data: {
        reservation_id: reservation.id,
        requested_by_account_id: u1.accountId,
        reason: 'QA 취소 요청',
        status: 'PENDING',
      },
    });
    await advanceReservationStatuses(kstTodayStart());
    const body = (await detail(reservation.id, u1.token)).body;
    expect(body.status).toBe('SHOOT_COMPLETED');
    expect(body.cancelRequest?.status).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------
describe('RESVDETAIL AC · 접근 제어', () => {
  it('RESVDETAIL-AC-01 비회원이면 401 UNAUTHORIZED', async () => {
    const reservation = await reserve('CONFIRMED');
    const res = await detail(reservation.id, null);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('RESVDETAIL-AC-02 당사자가 아닌 일반·작가 토큰이면 404 RESERVATION_NOT_FOUND', async () => {
    const reservation = await reserve('CONFIRMED');
    for (const token of [u3.token, p7.token]) {
      const res = await detail(reservation.id, token);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESERVATION_NOT_FOUND');
    }
  });
});
