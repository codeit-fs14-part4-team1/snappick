/**
 * RESV QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - 개수·순서를 정확히 보려고 시드 계정 대신 테스트 전용 계정(U1·U3·P1)을 새로 만든다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
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

type ReservationItem = {
  reservationId: string;
  name: string | null;
  counterpart: { nickname: string } | null;
  status: ReservationStatus;
  cancelRequestStatus: string | null;
  shootAt: string;
  createdAt: string;
};
type ReservationPage = {
  items: ReservationItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

const recorder = createRecorder('RESV BE · AC');

// 탭(type)별 상태 (QA 문서: 예정 = 예약 확정, 진행 = 촬영 완료·결과물 전달, 완료 = 구매 확정, 취소)
const TAB_STATUSES: Record<string, ReservationStatus[]> = {
  UPCOMING: ['CONFIRMED'],
  IN_PROGRESS: ['SHOOT_COMPLETED', 'DELIVERED'],
  COMPLETED: ['PURCHASE_CONFIRMED'],
  CANCELED: ['CANCELED'],
};

// U1–P1 예약 12건 (10개씩 2페이지). 만든 순서와 촬영일 순서를 일부러 다르게 둔다
const U1_STATUSES: ReservationStatus[] = [
  'CONFIRMED',
  'SHOOT_COMPLETED',
  'CONFIRMED',
  'DELIVERED',
  'PURCHASE_CONFIRMED',
  'CANCELED',
  'CONFIRMED',
  'SHOOT_COMPLETED',
  'DELIVERED',
  'PURCHASE_CONFIRMED',
  'CANCELED',
  'CONFIRMED',
];

let u1: Awaited<ReturnType<typeof createUserAccount>>;
let u3: Awaited<ReturnType<typeof createUserAccount>>;
let p1: Awaited<ReturnType<typeof createPhotographerAccount>>;
const u1ReservationIds: string[] = [];
let u3ReservationId = '';
let cancelRequestedId = '';

const list = (token: string | null, query = '') => {
  const req = api().get(`/me/reservations${query}`);
  return token ? req.set(bearer(token)) : req;
};

const create = (paymentId: string, token: string) =>
  api().post('/me/reservations').set(bearer(token)).send({ paymentId });

beforeAll(async () => {
  u1 = await createUserAccount('QA예약U1');
  u3 = await createUserAccount('QA예약U3');
  p1 = await createPhotographerAccount('QA예약P1');

  const base = Date.now() - 60 * DAY_MS;
  for (const [i, status] of U1_STATUSES.entries()) {
    const reservation = await createReservationRecord({
      userId: u1.userId,
      photographerId: p1.photographerId,
      status,
      createdAt: new Date(base + i * DAY_MS),
      // 촬영일은 만든 순서와 반대로 (먼저 만든 예약일수록 촬영일이 늦다)
      shootAt: new Date(Date.now() + (40 - i * 3) * DAY_MS),
      name: `QA 예약 ${i + 1}`,
    });
    u1ReservationIds.push(reservation.id);
  }

  // TD-4 취소 요청 중인 예약 확정
  cancelRequestedId = u1ReservationIds[0]!;
  await prisma.reservation_cancel_requests.create({
    data: {
      reservation_id: cancelRequestedId,
      requested_by_account_id: u1.accountId,
      reason: 'QA 취소 요청',
      status: 'PENDING',
    },
  });

  // 다른 일반 계정(U3)의 예약: P1에게는 보이고 U1에게는 보이면 안 된다
  u3ReservationId = (
    await createReservationRecord({
      userId: u3.userId,
      photographerId: p1.photographerId,
      status: 'CONFIRMED',
      createdAt: new Date(base - DAY_MS),
      name: 'QA U3 예약',
    })
  ).id;
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
describe('RESV BE · 예약 목록 GET /me/reservations', () => {
  it('RESV-BE-01 type 없이 부르면 모든 상태가 오고 pageSize 기본 10, 51이면 400 VALIDATION_FAILED', async () => {
    const res = await list(u1.token);
    expect(res.status).toBe(200);
    const page = res.body as ReservationPage;
    expect(page).toMatchObject({
      page: 1,
      pageSize: 10,
      totalCount: 12,
      totalPages: 2,
    });
    expect(page.items).toHaveLength(10);
    const second = (await list(u1.token, '?page=2')).body as ReservationPage;
    const statuses = new Set(
      [...page.items, ...second.items].map(({ status }) => status),
    );
    expect([...statuses].sort()).toEqual([
      'CANCELED',
      'CONFIRMED',
      'DELIVERED',
      'PURCHASE_CONFIRMED',
      'SHOOT_COMPLETED',
    ]);

    const tooLarge = await list(u1.token, '?pageSize=51');
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body.code).toBe('VALIDATION_FAILED');
  });

  it.each(Object.entries(TAB_STATUSES))(
    'RESV-BE-02 type=%s는 해당 상태의 예약만 온다',
    async (type, statuses) => {
      const page = (await list(u1.token, `?type=${type}&pageSize=50`))
        .body as ReservationPage;
      const expected = U1_STATUSES.filter((status) =>
        statuses.includes(status),
      ).length;
      expect(page.totalCount).toBe(expected);
      expect(page.items).toHaveLength(expected);
      page.items.forEach(({ status }) => expect(statuses).toContain(status));
    },
  );

  it('RESV-BE-R1 탭 개수의 합이 전체 개수와 같다 (L2-04)', async () => {
    const counts = await Promise.all(
      Object.keys(TAB_STATUSES).map(
        async (type) =>
          ((await list(u1.token, `?type=${type}`)).body as ReservationPage)
            .totalCount,
      ),
    );
    const all = ((await list(u1.token)).body as ReservationPage).totalCount;
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(all);
  });

  it.each([
    ['type=NOPE', '?type=NOPE'],
    ['page=0', '?page=0'],
  ])('RESV-BE-03 %s면 400 VALIDATION_FAILED', async (_label, query) => {
    const res = await list(u1.token, query);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('RESV-BE-04 예약은 만들어진 최신순으로 온다 (촬영일 순이 아니다, L2-05)', async () => {
    const page1 = (await list(u1.token)).body as ReservationPage;
    const page2 = (await list(u1.token, '?page=2')).body as ReservationPage;
    const items = [...page1.items, ...page2.items];
    expect(items.map(({ reservationId }) => reservationId)).toEqual(
      [...u1ReservationIds].reverse(),
    );
    const shootTimes = items.map(({ shootAt }) => new Date(shootAt).getTime());
    expect(shootTimes).toEqual([...shootTimes].sort((a, b) => a - b));
  });

  it('RESV-BE-R2 상대 칸: 일반 계정은 작가 닉네임, 작가 계정은 고객 닉네임 (L2-02)', async () => {
    const userView = (await list(u1.token, '?pageSize=50'))
      .body as ReservationPage;
    userView.items.forEach(({ counterpart }) =>
      expect(counterpart?.nickname).toBe(p1.nickname),
    );

    const photographerView = (await list(p1.token, '?pageSize=50'))
      .body as ReservationPage;
    const byId = new Map(
      photographerView.items.map((item) => [item.reservationId, item]),
    );
    expect(byId.get(u1ReservationIds[0]!)?.counterpart?.nickname).toBe(
      u1.nickname,
    );
    expect(byId.get(u3ReservationId)?.counterpart?.nickname).toBe(u3.nickname);
  });

  it('RESV-BE-R3 취소 요청 중인 예약은 cancelRequestStatus가 PENDING이다 (L1-04)', async () => {
    const page = (await list(u1.token, '?pageSize=50')).body as ReservationPage;
    page.items.forEach((item) =>
      expect(item.cancelRequestStatus).toBe(
        item.reservationId === cancelRequestedId ? 'PENDING' : null,
      ),
    );
  });
});

// ---------------------------------------------------------------------------
describe('RESV BE · 예약 생성 POST /me/reservations', () => {
  it('RESV-BE-05 이미 예약이 만들어진 결제로 다시 부르면 409 RESERVATION_ALREADY_EXISTS', async () => {
    const payment = await createPayment({
      userId: u1.userId,
      photographerId: p1.photographerId,
      status: 'SUCCEEDED',
    });
    const first = await create(payment.id, u1.token);
    expect(first.status).toBe(201);
    expect(first.body.reservationId).toBeTruthy();

    // 새 예약은 예약 확정으로 예정 탭 맨 위에 온다 (L2-01 서버 쪽)
    const upcoming = (await list(u1.token, '?type=UPCOMING'))
      .body as ReservationPage;
    expect(upcoming.items[0]).toMatchObject({
      reservationId: first.body.reservationId,
      status: 'CONFIRMED',
    });

    const again = await create(payment.id, u1.token);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('RESERVATION_ALREADY_EXISTS');
  });

  it('RESV-BE-06a 형식은 맞지만 없는 결제 id면 404 PAYMENT_NOT_FOUND', async () => {
    const res = await create(randomUUID(), u1.token);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PAYMENT_NOT_FOUND');
  });

  it.each(['READY', 'PENDING', 'FAILED'] as const)(
    'RESV-BE-06b 성공하지 않은 결제(%s)면 409 PAYMENT_NOT_SUCCEEDED',
    async (status) => {
      const payment = await createPayment({
        userId: u3.userId,
        photographerId: p1.photographerId,
        status,
      });
      const res = await create(payment.id, u3.token);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PAYMENT_NOT_SUCCEEDED');
    },
  );

  it('RESV-BE-06c UUID가 아니면 400 VALIDATION_FAILED', async () => {
    const res = await create('not-a-uuid', u1.token);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
describe('RESV AC · 접근 제어', () => {
  it('RESV-AC-01 비회원이 GET /me/reservations면 401 UNAUTHORIZED', async () => {
    const res = await list(null);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('RESV-AC-02 일반·작가 토큰이면 자기 예약만 온다', async () => {
    const own = async (where: { user_id?: string; photographer_id?: string }) =>
      new Set(
        (
          await prisma.reservations.findMany({ where, select: { id: true } })
        ).map(({ id }) => id),
      );

    const userIds = (
      (await list(u1.token, '?pageSize=50')).body as ReservationPage
    ).items.map(({ reservationId }) => reservationId);
    const u1Own = await own({ user_id: u1.userId });
    expect(userIds.length).toBe(u1Own.size);
    userIds.forEach((id) => expect(u1Own.has(id)).toBe(true));
    expect(userIds).not.toContain(u3ReservationId);

    const photographerIds = (
      (await list(p1.token, '?pageSize=50')).body as ReservationPage
    ).items.map(({ reservationId }) => reservationId);
    const p1Own = await own({ photographer_id: p1.photographerId });
    expect(photographerIds.length).toBe(p1Own.size);
    photographerIds.forEach((id) => expect(p1Own.has(id)).toBe(true));
  });

  it('RESV-AC-04 다른 계정의 결제 id로 POST /me/reservations 응답 코드와 예약 생성 여부를 기록', async () => {
    const othersPayment = await createPayment({
      userId: u3.userId,
      photographerId: p1.photographerId,
      status: 'SUCCEEDED',
    });
    const res = await create(othersPayment.id, u1.token);
    recorder.record('RESV-AC-04', {
      status: res.status,
      code: res.body.code,
      예약생성:
        (await prisma.reservations.count({
          where: { payment_id: othersPayment.id },
        })) > 0,
    });
  });

  it('RESV-AC-05 작가 토큰으로 POST /me/reservations면 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    const payment = await createPayment({
      userId: u1.userId,
      photographerId: p1.photographerId,
      status: 'SUCCEEDED',
    });
    const res = await create(payment.id, p1.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
  });
});
