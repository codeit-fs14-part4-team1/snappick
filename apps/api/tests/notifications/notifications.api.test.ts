/**
 * NOTI QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다 (받는 사람·문구·이동 대상·생성 여부)
 * - "채팅방을 보고 있다"(NT-13)는 소켓 방 조회를 가짜로 바꿔 정한다. 실제 소켓 연결·실시간 도착은 화면에서 본다
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NotiType } from '../../src/generated/prisma/enums.js';
import { prisma } from '../../src/lib/prisma.js';
import { setChatViewerSource } from '../../src/modules/notifications/notifications.viewers.js';
import { api, bearer } from '../helpers.js';
import {
  DAY_MS,
  createPhotographerAccount,
  createQuoteCase,
  createReservationRecord,
  createUserAccount,
} from '../fixtures.js';

type Account = Awaited<ReturnType<typeof createUserAccount>>;
type Photographer = Awaited<ReturnType<typeof createPhotographerAccount>>;

let u1: Account;
let u3: Account;
let p1: Photographer;
let productId = '';

// 채팅방을 보고 있는 계정 (방 id → 계정 id)
const viewers = new Map<string, Set<string>>();
const view = (roomId: string, accountId: string) =>
  viewers.set(roomId, new Set([...(viewers.get(roomId) ?? []), accountId]));

beforeAll(async () => {
  setChatViewerSource({
    in: (room: string) => ({
      fetchSockets: async () =>
        [...(viewers.get(room.replace('viewing:', '')) ?? [])].map(
          (accountId) => ({
            data: { auth: { accountId } },
          }),
        ),
    }),
  } as unknown as Server);

  u1 = await createUserAccount('QA알림U1');
  u3 = await createUserAccount('QA알림U3');
  p1 = await createPhotographerAccount('QA알림P1');
  productId = (
    await prisma.products.create({
      data: {
        photographer_id: p1.photographerId,
        name: 'QA 상품',
        price: 100_000,
        duration_minutes: 60,
        photo_count: 10,
        includes_original: false,
      },
    })
  ).id;
});

beforeEach(() => {
  viewers.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// 도우미

const list = (token: string | null, query = '') => {
  const req = api().get(`/me/notifications${query}`);
  return token ? req.set(bearer(token)) : req;
};
const hasUnread = async (token: string) =>
  (await api().get('/me/notifications/has-unread').set(bearer(token))).body as {
    hasUnread: boolean;
    hasUnseen: boolean;
  };
const seen = (token: string | null, notificationIds: unknown) => {
  const req = api().patch('/me/notifications/seen').send({ notificationIds });
  return token ? req.set(bearer(token)) : req;
};
const read = (token: string | null, id: string) => {
  const req = api().patch(`/me/notifications/${id}/read`);
  return token ? req.set(bearer(token)) : req;
};

/** 계정이 받은 알림 (DB, 최신순) */
const notis = (accountId: string, type?: NotiType, targetId?: string) =>
  prisma.notifications.findMany({
    where: {
      auth_account_id: accountId,
      ...(type && { type }),
      ...(targetId && { target_id: targetId }),
    },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });

/** 알림을 직접 만든다 (목록·확인·읽음 테스트용) */
async function seedNotifications(
  accountId: string,
  count: number,
  base = Date.now() - 60 * 60 * 1000,
) {
  await prisma.notifications.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      auth_account_id: accountId,
      type: 'NEW_REVIEW' as const,
      target_type: 'PHOTOGRAPHER_PROFILE' as const,
      target_id: randomUUID(),
      message: `QA 알림 ${i + 1}`,
      created_at: new Date(base + i * 1000),
    })),
  });
  return notis(accountId);
}

/** U1–P1 새 채팅방 (매번 새 일반 계정이 필요하면 user를 넘긴다) */
const newRoom = async (user: Account = u1) =>
  (
    await prisma.chat_rooms.upsert({
      where: {
        user_id_photographer_id: {
          user_id: user.userId,
          photographer_id: p1.photographerId,
        },
      },
      create: { user_id: user.userId, photographer_id: p1.photographerId },
      update: {},
    })
  ).id;

const sendText = (roomId: string, token: string, content = 'QA 메시지') =>
  api()
    .post(`/chats/${roomId}/messages`)
    .set(bearer(token))
    .send({ messageType: 'TEXT', content });

/** 촬영일을 정한 0원 견적을 결제해 예약 확정까지 (예약 확정·촬영일 알림이 생긴다) */
async function confirmFreeReservation(
  user: Account,
  shootAt = new Date(Date.now() + 20 * DAY_MS),
) {
  const { latest, roomId } = await createQuoteCase({
    userId: user.userId,
    photographerId: p1.photographerId,
    price: 0,
    shootAt,
  });
  const res = await api()
    .post('/payments')
    .set(bearer(user.token))
    .send({ quoteId: latest.id });
  expect(res.status).toBe(201);
  return { reservationId: res.body.reservationId as string, roomId };
}

// ---------------------------------------------------------------------------
describe('NOTI BE · 목록 GET /me/notifications', () => {
  it('NOTI-BE-01 최신순, limit 없이 20개, limit=0·51은 400 VALIDATION_FAILED', async () => {
    const user = await createUserAccount('QA알림목록');
    await seedNotifications(user.accountId, 25);
    const page = (await list(user.token)).body;
    expect(page.items).toHaveLength(20);
    expect(page.items[0].message).toBe('QA 알림 25');
    const times = page.items.map(
      ({ createdAt }: { createdAt: string }) => createdAt,
    );
    expect(times).toEqual([...times].sort().reverse());

    for (const limit of [0, 51]) {
      const res = await list(user.token, `?limit=${limit}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
  });

  it('NOTI-BE-02 nextCursor로 끝까지 받으면 겹치지 않고, 첫 페이지 뒤 새 알림이 생겨도 다음 페이지가 밀리지 않는다', async () => {
    const user = await createUserAccount('QA알림커서');
    await seedNotifications(user.accountId, 25);
    const first = (await list(user.token, '?limit=10')).body;
    const expectedSecond = (
      await list(user.token, `?limit=10&cursor=${first.nextCursor}`)
    ).body;

    await seedNotifications(user.accountId, 3, Date.now());
    const second = (
      await list(user.token, `?limit=10&cursor=${first.nextCursor}`)
    ).body;
    expect(second.items).toEqual(expectedSecond.items);

    const third = (
      await list(user.token, `?limit=10&cursor=${second.nextCursor}`)
    ).body;
    expect(third.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items, ...third.items].map(
      ({ notificationId }: { notificationId: string }) => notificationId,
    );
    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
  });

  it('NOTI-BE-03 임의의 cursor면 400 INVALID_CURSOR', async () => {
    const forged = Buffer.from(JSON.stringify({ t: 'x', i: 'y' })).toString(
      'base64url',
    );
    for (const cursor of ['abc', forged]) {
      const res = await list(u1.token, `?cursor=${cursor}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CURSOR');
    }
  });

  it('NOTI-BE-04 보낼 시각이 지나지 않은 촬영일 알림은 응답에 없다', async () => {
    const user = await createUserAccount('QA알림예약');
    const reservation = await createReservationRecord({
      userId: user.userId,
      photographerId: p1.photographerId,
      status: 'CONFIRMED',
      createdAt: new Date(),
    });
    const [past, future] = await Promise.all(
      [-60_000, 60 * 60 * 1000].map((offset) =>
        prisma.notifications.create({
          data: {
            auth_account_id: user.accountId,
            type: 'SHOOT_REMINDER',
            target_type: 'RESERVATION',
            target_id: reservation.id,
            message: 'QA 촬영일 알림',
            scheduled_at: new Date(Date.now() + offset),
            created_at: new Date(Date.now() + offset),
          },
        }),
      ),
    );
    const ids = (await list(user.token)).body.items.map(
      ({ notificationId }: { notificationId: string }) => notificationId,
    );
    expect(ids).toContain(past!.id);
    expect(ids).not.toContain(future!.id);
  });
});

// ---------------------------------------------------------------------------
describe('NOTI BE · 새 알림 여부 · 확인 · 읽음', () => {
  it('NOTI-BE-05 안 읽은 알림이 있으면 hasUnread, 미확인이 있으면 hasUnseen, 모두 확인하면 hasUnseen만 false', async () => {
    const user = await createUserAccount('QA알림점');
    expect(await hasUnread(user.token)).toEqual({
      hasUnread: false,
      hasUnseen: false,
    });

    const [a, b] = await seedNotifications(user.accountId, 2);
    expect(await hasUnread(user.token)).toEqual({
      hasUnread: true,
      hasUnseen: true,
    });

    await seen(user.token, [a!.id, b!.id]);
    expect(await hasUnread(user.token)).toEqual({
      hasUnread: true,
      hasUnseen: false,
    });

    await read(user.token, a!.id);
    await read(user.token, b!.id);
    expect(await hasUnread(user.token)).toEqual({
      hasUnread: false,
      hasUnseen: false,
    });
  });

  it('NOTI-BE-06 내 안 읽은 미확인 알림만 확인되고 updatedCount가 오며, 다시 보내면 0', async () => {
    const user = await createUserAccount('QA알림확인');
    const [a, b, alreadyRead] = await seedNotifications(user.accountId, 3);
    await read(user.token, alreadyRead!.id);

    const first = await seen(user.token, [a!.id, b!.id, alreadyRead!.id]);
    expect(first.status).toBe(200);
    expect(first.body.updatedCount).toBe(2);
    expect(
      (await seen(user.token, [a!.id, b!.id, alreadyRead!.id])).body
        .updatedCount,
    ).toBe(0);
    // 확인은 읽음이 아니다 (NT-14)
    const rows = await notis(user.accountId);
    expect(rows.find(({ id }) => id === a!.id)).toMatchObject({
      read_at: null,
      seen_at: expect.any(Date),
    });
  });

  it.each([
    ['빈 배열', []],
    ['101개', Array.from({ length: 101 }, () => randomUUID())],
    ['UUID가 아닌 값', [randomUUID(), 'not-a-uuid']],
  ])(
    'NOTI-BE-07 notificationIds가 %s이면 400 VALIDATION_FAILED',
    async (_label, ids) => {
      const res = await seen(u1.token, ids);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it('NOTI-BE-08 다른 계정의 알림 id는 바뀌지 않고 updatedCount에 세지 않는다', async () => {
    const owner = await createUserAccount('QA알림주인');
    const [others] = await seedNotifications(owner.accountId, 1);
    const res = await seen(u3.token, [others!.id]);
    expect(res.body.updatedCount).toBe(0);
    expect(
      (
        await prisma.notifications.findUniqueOrThrow({
          where: { id: others!.id },
        })
      ).seen_at,
    ).toBeNull();
  });

  it('NOTI-BE-09 읽으면 200, read: true, readAt이 오고 다시 읽어도 처음 readAt 그대로', async () => {
    const user = await createUserAccount('QA알림읽음');
    const [n] = await seedNotifications(user.accountId, 1);
    const first = await read(user.token, n!.id);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      notificationId: n!.id,
      read: true,
      readAt: expect.any(String),
    });
    const again = await read(user.token, n!.id);
    expect(again.body.readAt).toBe(first.body.readAt);
  });

  it('NOTI-BE-10 없는 UUID면 404 NOTIFICATION_NOT_FOUND, UUID가 아니면 400 VALIDATION_FAILED', async () => {
    const missing = await read(u1.token, randomUUID());
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOTIFICATION_NOT_FOUND');
    const invalid = await read(u1.token, 'not-a-uuid');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
describe('NOTI BE · 메시지 알림 생성 (NT-13)', () => {
  it('NOTI-BE-11 받는 사람이 방을 보지 않을 때 메시지 3개를 보내면 NEW_MESSAGE는 1건, 시각은 처음 그대로 (L2-19)', async () => {
    const user = await createUserAccount('QA알림연속');
    const roomId = await newRoom(user);
    await sendText(roomId, user.token, 'QA 1');
    const [first] = await notis(p1.accountId, 'NEW_MESSAGE', roomId);
    await sendText(roomId, user.token, 'QA 2');
    await sendText(roomId, user.token, 'QA 3');
    const rows = await notis(p1.accountId, 'NEW_MESSAGE', roomId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.created_at).toEqual(first!.created_at);
  });

  it('NOTI-BE-12 같은 방에 메시지를 동시에 두 번 보내도 NEW_MESSAGE는 1건', async () => {
    const user = await createUserAccount('QA알림동시');
    const roomId = await newRoom(user);
    const results = await Promise.all([
      sendText(roomId, user.token, 'QA a'),
      sendText(roomId, user.token, 'QA b'),
    ]);
    results.forEach(({ status }) => expect(status).toBe(201));
    expect(await notis(p1.accountId, 'NEW_MESSAGE', roomId)).toHaveLength(1);
  });

  it('NOTI-BE-R1 방에 들어가 읽으면 그 방의 메시지·문의·견적 알림이 읽음이 되고, 그 뒤 메시지부터 새 알림이 생긴다 (L2-05, L2-19)', async () => {
    const user = await createUserAccount('QA알림방읽음');
    const roomId = await newRoom(user);
    await api()
      .post(`/chats/${roomId}/messages`)
      .set(bearer(user.token))
      .send({ messageType: 'INITIAL_REQUEST', payload: { region: 'SEOUL' } });
    const last = (await sendText(roomId, user.token, 'QA 읽기 전')).body;

    const readRes = await api()
      .patch(`/chats/${roomId}/read`)
      .set(bearer(p1.token))
      .send({ lastReadMessageId: last.id });
    expect(readRes.status).toBe(200);
    const rows = await prisma.notifications.findMany({
      where: {
        auth_account_id: p1.accountId,
        target_id: roomId,
        type: { in: ['NEW_MESSAGE', 'NEW_INQUIRY'] },
      },
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    rows.forEach(({ read_at }) => expect(read_at).not.toBeNull());

    await sendText(roomId, user.token, 'QA 읽은 뒤');
    const unread = await prisma.notifications.count({
      where: {
        auth_account_id: p1.accountId,
        target_id: roomId,
        type: 'NEW_MESSAGE',
        read_at: null,
      },
    });
    expect(unread).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('NOTI BE · 유형별 알림 (받는 사람 · 문구 · 이동 대상)', () => {
  it('NOTI-BE-R2 메시지 → 상대에게 "{보낸 사람}님이 메시지를 보냈어요.", 채팅방으로 (L2-06)', async () => {
    const user = await createUserAccount('QA알림메시지');
    const roomId = await newRoom(user);
    await sendText(roomId, user.token, 'QA 비밀 내용');
    const [n] = await notis(p1.accountId, 'NEW_MESSAGE', roomId);
    expect(n).toMatchObject({
      message: `${user.nickname}님이 메시지를 보냈어요.`,
      target_type: 'CHAT_ROOM',
      target_id: roomId,
    });
    expect(n!.message).not.toContain('QA 비밀 내용');
  });

  it('NOTI-BE-R3 촬영 정보 → 작가에게 "{고객}님이 문의를 보냈어요.", 채팅방으로 (L2-07)', async () => {
    const user = await createUserAccount('QA알림문의');
    const roomId = await newRoom(user);
    await api()
      .post(`/chats/${roomId}/messages`)
      .set(bearer(user.token))
      .send({ messageType: 'INITIAL_REQUEST', payload: { region: 'SEOUL' } });
    const [n] = await notis(p1.accountId, 'NEW_INQUIRY', roomId);
    expect(n).toMatchObject({
      message: `${user.nickname}님이 문의를 보냈어요.`,
      target_type: 'CHAT_ROOM',
    });
  });

  it('NOTI-BE-R4 견적 → 고객에게 "{작가}님이 견적을 보냈어요.", 채팅방으로 (L2-08)', async () => {
    const user = await createUserAccount('QA알림견적');
    const roomId = await newRoom(user);
    const res = await api()
      .post('/quotes')
      .set(bearer(p1.token))
      .send({
        chatRoomId: roomId,
        productId,
        quoteName: 'QA 견적',
        shootAt: new Date(Date.now() + 20 * DAY_MS).toISOString(),
        location: '서울',
        locationLat: 37.5,
        locationLng: 127,
        durationMinutes: 60,
        price: 100_000,
        photoCount: 10,
        includesOriginal: false,
      });
    expect(res.status).toBe(201);
    const [n] = await notis(user.accountId, 'NEW_QUOTE', roomId);
    expect(n).toMatchObject({
      message: `${p1.nickname}님이 견적을 보냈어요.`,
      target_type: 'CHAT_ROOM',
    });
  });

  it('NOTI-BE-R5 예약 확정 → 고객 "{작가} 작가님과의 예약이 확정됐어요.", 작가 "{고객}님과의 예약이 확정됐어요.", 예약 상세로 (L2-09)', async () => {
    const user = await createUserAccount('QA알림확정');
    const { reservationId } = await confirmFreeReservation(user);
    const [toUser] = await notis(
      user.accountId,
      'RESERVATION_CONFIRMED',
      reservationId,
    );
    const [toPhotographer] = await notis(
      p1.accountId,
      'RESERVATION_CONFIRMED',
      reservationId,
    );
    expect(toUser).toMatchObject({
      message: `${p1.nickname} 작가님과의 예약이 확정됐어요.`,
      target_type: 'RESERVATION',
    });
    expect(toPhotographer).toMatchObject({
      message: `${user.nickname}님과의 예약이 확정됐어요.`,
      target_type: 'RESERVATION',
    });
  });

  it('NOTI-BE-R6 결과물 전달 → 고객에게 "{작가} 작가님이 결과물을 전달했어요.", 수정해도 새 알림 없음 (L2-10, L2-11)', async () => {
    const user = await createUserAccount('QA알림결과물');
    const reservation = await createReservationRecord({
      userId: user.userId,
      photographerId: p1.photographerId,
      status: 'SHOOT_COMPLETED',
      createdAt: new Date(),
    });
    const url = `/me/reservations/${reservation.id}/deliverable`;
    const expiration = new Date(Date.now() + 9 * 60 * 60 * 1000 + 30 * DAY_MS)
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '.');
    expect(
      (
        await api().post(url).set(bearer(p1.token)).send({
          link: 'https://example.com/qa',
          expirationPeriod: expiration,
        })
      ).status,
    ).toBe(201);
    const rows = await notis(
      user.accountId,
      'DELIVERY_COMPLETED',
      reservation.id,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      message: `${p1.nickname} 작가님이 결과물을 전달했어요.`,
      target_type: 'RESERVATION',
    });

    await api().patch(url).set(bearer(p1.token)).send({ notice: 'QA 수정' });
    expect(
      await notis(user.accountId, 'DELIVERY_COMPLETED', reservation.id),
    ).toHaveLength(1);
  });

  it('NOTI-BE-R7 리뷰 → 작가에게 "{고객}님이 리뷰를 남겼어요.", 작가 프로필로. 고객에게는 없음 (L2-12)', async () => {
    const user = await createUserAccount('QA알림리뷰');
    const reservation = await createReservationRecord({
      userId: user.userId,
      photographerId: p1.photographerId,
      status: 'PURCHASE_CONFIRMED',
      createdAt: new Date(),
    });
    await api()
      .post('/me/reviews')
      .set(bearer(user.token))
      .send({ reservationId: reservation.id, rating: 5, comment: 'QA 좋아요' });
    const [n] = await notis(p1.accountId, 'NEW_REVIEW', p1.photographerId);
    expect(n).toMatchObject({
      message: `${user.nickname}님이 리뷰를 남겼어요.`,
      target_type: 'PHOTOGRAPHER_PROFILE',
      target_id: p1.photographerId,
    });
    expect(await notis(user.accountId, 'NEW_REVIEW')).toHaveLength(0);
  });

  it('NOTI-BE-R8 취소 요청·반려·확정 → 문서 문구대로 받는 사람에게 간다 (L2-13 DQ-01, L2-14, L2-15)', async () => {
    const user = await createUserAccount('QA알림취소');
    const reservation = await createReservationRecord({
      userId: user.userId,
      photographerId: p1.photographerId,
      status: 'CONFIRMED',
      createdAt: new Date(),
    });
    const cancelUrl = `/me/reservations/${reservation.id}/cancel`;

    const requested = (
      await api()
        .post(cancelUrl)
        .set(bearer(user.token))
        .send({ reason: 'QA 요청' })
    ).body;
    const [req1] = await notis(
      p1.accountId,
      'CANCEL_REQUESTED',
      reservation.id,
    );
    expect(req1).toMatchObject({
      message: `${user.nickname}님이 예약 취소를 요청했어요.`,
      target_type: 'RESERVATION',
    });

    await api()
      .patch(`${cancelUrl}/${requested.cancelRequestId}`)
      .set(bearer(p1.token))
      .send({ status: 'REJECTED' });
    const [rejected] = await notis(
      user.accountId,
      'CANCEL_REJECTED',
      reservation.id,
    );
    expect(rejected).toMatchObject({
      message: `${p1.nickname} 작가님이 취소 요청을 반려했어요.`,
    });

    const again = (
      await api()
        .post(cancelUrl)
        .set(bearer(user.token))
        .send({ reason: 'QA 다시' })
    ).body;
    await api()
      .patch(`${cancelUrl}/${again.cancelRequestId}`)
      .set(bearer(p1.token))
      .send({ status: 'ACCEPTED', reason: 'QA 수락' });
    const [canceledUser] = await notis(
      user.accountId,
      'RESERVATION_CANCELED',
      reservation.id,
    );
    const [canceledPhotographer] = await notis(
      p1.accountId,
      'RESERVATION_CANCELED',
      reservation.id,
    );
    expect(canceledUser).toMatchObject({
      message: `${p1.nickname} 작가님과의 예약이 취소됐어요.`,
    });
    expect(canceledPhotographer).toMatchObject({
      message: `${user.nickname}님과의 예약이 취소됐어요.`,
    });
  });

  it('NOTI-BE-R9 작가 직접 취소 → 양쪽에 "예약이 취소됐어요" 알림 (L2-15)', async () => {
    const user = await createUserAccount('QA알림직접취소');
    const reservation = await createReservationRecord({
      userId: user.userId,
      photographerId: p1.photographerId,
      status: 'CONFIRMED',
      createdAt: new Date(),
    });
    await api()
      .post(`/me/reservations/${reservation.id}/cancel`)
      .set(bearer(p1.token))
      .send({ reason: 'QA 작가 사정' });
    expect(
      await notis(user.accountId, 'RESERVATION_CANCELED', reservation.id),
    ).toEqual([
      expect.objectContaining({
        message: `${p1.nickname} 작가님과의 예약이 취소됐어요.`,
      }),
    ]);
    expect(
      await notis(p1.accountId, 'RESERVATION_CANCELED', reservation.id),
    ).toEqual([
      expect.objectContaining({
        message: `${user.nickname}님과의 예약이 취소됐어요.`,
      }),
    ]);
  });
});

// ---------------------------------------------------------------------------
describe('NOTI BE · 채팅방을 보고 있을 때 (NT-13)', () => {
  it('NOTI-BE-R10 받는 사람이 방을 보고 있으면 메시지·견적 알림이 생기지 않는다 (L2-17)', async () => {
    const user = await createUserAccount('QA알림보는중');
    const roomId = await newRoom(user);
    view(roomId, p1.accountId);
    view(roomId, user.accountId);
    await sendText(roomId, user.token);
    await api()
      .post('/quotes')
      .set(bearer(p1.token))
      .send({
        chatRoomId: roomId,
        productId,
        quoteName: 'QA 견적',
        shootAt: new Date(Date.now() + 20 * DAY_MS).toISOString(),
        location: '서울',
        locationLat: 37.5,
        locationLng: 127,
        durationMinutes: 60,
        price: 100_000,
        photoCount: 10,
        includesOriginal: false,
      });
    expect(await notis(p1.accountId, 'NEW_MESSAGE', roomId)).toHaveLength(0);
    expect(await notis(user.accountId, 'NEW_QUOTE', roomId)).toHaveLength(0);
  });

  it('NOTI-BE-R11 받는 사람이 그 예약의 채팅방을 보고 있으면 취소 요청 알림이 생기지 않는다 (L2-18)', async () => {
    const user = await createUserAccount('QA알림보는중취소');
    const reservation = await createReservationRecord({
      userId: user.userId,
      photographerId: p1.photographerId,
      status: 'CONFIRMED',
      createdAt: new Date(),
    });
    const quote = await prisma.quotes.findUniqueOrThrow({
      where: { id: reservation.quote_id! },
    });
    view(quote.chat_room_id!, p1.accountId);
    await api()
      .post(`/me/reservations/${reservation.id}/cancel`)
      .set(bearer(user.token))
      .send({ reason: 'QA' });
    expect(
      await notis(p1.accountId, 'CANCEL_REQUESTED', reservation.id),
    ).toHaveLength(0);
  });

  it('NOTI-BE-R12 받는 사람이 그 예약의 채팅방을 보고 있으면 예약 확정 알림이 생기지 않는다 (L2-18)', async () => {
    const user = await createUserAccount('QA알림보는중확정');
    const { latest, roomId } = await createQuoteCase({
      userId: user.userId,
      photographerId: p1.photographerId,
      price: 0,
    });
    view(roomId, p1.accountId);
    const res = await api()
      .post('/payments')
      .set(bearer(user.token))
      .send({ quoteId: latest.id });
    expect(
      await notis(
        p1.accountId,
        'RESERVATION_CONFIRMED',
        res.body.reservationId,
      ),
    ).toHaveLength(0);
    expect(
      await notis(
        user.accountId,
        'RESERVATION_CONFIRMED',
        res.body.reservationId,
      ),
    ).toHaveLength(1);
  });

  it('NOTI-BE-R13 작가가 방을 보고 있어도 촬영 정보 문의 알림은 생긴다 (L2-20)', async () => {
    const user = await createUserAccount('QA알림보는중문의');
    const roomId = await newRoom(user);
    view(roomId, p1.accountId);
    await api()
      .post(`/chats/${roomId}/messages`)
      .set(bearer(user.token))
      .send({ messageType: 'INITIAL_REQUEST', payload: { region: 'SEOUL' } });
    expect(await notis(p1.accountId, 'NEW_INQUIRY', roomId)).toHaveLength(1);
  });

  it('NOTI-BE-R14 고객이 방을 보고 있어도 결과물 전달 알림은 생긴다 (L2-21)', async () => {
    const user = await createUserAccount('QA알림보는중결과물');
    const reservation = await createReservationRecord({
      userId: user.userId,
      photographerId: p1.photographerId,
      status: 'SHOOT_COMPLETED',
      createdAt: new Date(),
    });
    const quote = await prisma.quotes.findUniqueOrThrow({
      where: { id: reservation.quote_id! },
    });
    view(quote.chat_room_id!, user.accountId);
    const expiration = new Date(Date.now() + 9 * 60 * 60 * 1000 + 30 * DAY_MS)
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '.');
    await api()
      .post(`/me/reservations/${reservation.id}/deliverable`)
      .set(bearer(p1.token))
      .send({ link: 'https://example.com/qa', expirationPeriod: expiration });
    expect(
      await notis(user.accountId, 'DELIVERY_COMPLETED', reservation.id),
    ).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe('NOTI BE · 촬영일 알림 (NT-06)', () => {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  /** 오늘(한국 날짜)에서 days일 뒤 h시 (한국 시간) */
  const kstAt = (days: number, hour: number) => {
    const kst = new Date(Date.now() + KST_OFFSET_MS);
    return new Date(
      Date.UTC(
        kst.getUTCFullYear(),
        kst.getUTCMonth(),
        kst.getUTCDate() + days,
        hour,
      ) - KST_OFFSET_MS,
    );
  };

  it('NOTI-BE-R15 예약 확정 때 전날·당일 오전 6시 알림이 양쪽에 미리 생기고, 그 전에는 목록에 없다 (L2-22, L2-23)', async () => {
    const user = await createUserAccount('QA알림촬영일');
    const { reservationId } = await confirmFreeReservation(user, kstAt(3, 15));
    const time = '오후 3:00';
    for (const [account, counterpart] of [
      [user, `${p1.nickname} 작가님`],
      [p1, `${user.nickname}님`],
    ] as const) {
      const rows = await notis(
        account.accountId,
        'SHOOT_REMINDER',
        reservationId,
      );
      expect(
        rows.map(({ scheduled_at }) => scheduled_at?.getTime()).sort(),
      ).toEqual([kstAt(2, 6).getTime(), kstAt(3, 6).getTime()].sort());
      expect(rows.map(({ message }) => message).sort()).toEqual(
        [
          `내일 ${time} ${counterpart}과 촬영이 있어요.`,
          `오늘 ${time} ${counterpart}과 촬영이 있어요.`,
        ].sort(),
      );
      // 목록의 시각은 보낼 시각(오전 6시)
      rows.forEach(({ created_at, scheduled_at }) =>
        expect(created_at).toEqual(scheduled_at),
      );
    }
    const ids = (await list(user.token, '?limit=50')).body.items.map(
      ({ notificationId }: { notificationId: string }) => notificationId,
    );
    const reminders = await notis(
      user.accountId,
      'SHOOT_REMINDER',
      reservationId,
    );
    reminders.forEach(({ id }) => expect(ids).not.toContain(id));
  });

  it('NOTI-BE-R16 예약 확정 시각이 그날 오전 6시를 지났으면 그 날의 촬영일 알림은 만들지 않는다 (L2-24)', async () => {
    const user = await createUserAccount('QA알림늦은확정');
    // 내일 촬영: 전날(오늘) 6시가 이미 지났으면 당일 알림만
    const { reservationId } = await confirmFreeReservation(user, kstAt(1, 15));
    const expected = [kstAt(0, 6), kstAt(1, 6)]
      .filter((at) => at.getTime() > Date.now())
      .map((at) => at.getTime());
    const rows = await notis(user.accountId, 'SHOOT_REMINDER', reservationId);
    expect(
      rows.map(({ scheduled_at }) => scheduled_at!.getTime()).sort(),
    ).toEqual(expected.sort());
  });

  it('NOTI-BE-R17 예약이 취소되면 보내지 않은 알림은 지워지고, 온 뒤 확인·읽지 않은 알림은 목록에서 사라지며, 확인한 알림은 남는다 (L2-25)', async () => {
    const user = await createUserAccount('QA알림취소촬영일');
    const reservation = await createReservationRecord({
      userId: user.userId,
      photographerId: p1.photographerId,
      status: 'CONFIRMED',
      createdAt: new Date(),
    });
    const make = (offset: number, seenAt: Date | null) =>
      prisma.notifications.create({
        data: {
          auth_account_id: user.accountId,
          type: 'SHOOT_REMINDER',
          target_type: 'RESERVATION',
          target_id: reservation.id,
          message: 'QA 촬영일 알림',
          scheduled_at: new Date(Date.now() + offset),
          created_at: new Date(Date.now() + offset),
          seen_at: seenAt,
        },
      });
    const deliveredUnseen = await make(-2 * 60_000, null);
    const deliveredSeen = await make(-60_000, new Date());
    const pending = await make(60 * 60 * 1000, null);

    await api()
      .post(`/me/reservations/${reservation.id}/cancel`)
      .set(bearer(p1.token))
      .send({ reason: 'QA 작가 사정' });

    expect(
      await prisma.notifications.findUnique({ where: { id: pending.id } }),
    ).toBeNull();
    const ids = (await list(user.token, '?limit=50')).body.items.map(
      ({ notificationId }: { notificationId: string }) => notificationId,
    );
    expect(ids).not.toContain(deliveredUnseen.id);
    expect(ids).toContain(deliveredSeen.id);
  });
});

// ---------------------------------------------------------------------------
describe('NOTI AC · 접근 제어', () => {
  it('NOTI-AC-01 비회원이 목록·has-unread·seen·read면 401 UNAUTHORIZED', async () => {
    for (const res of [
      await list(null),
      await api().get('/me/notifications/has-unread'),
      await seen(null, [randomUUID()]),
      await read(null, randomUUID()),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('NOTI-AC-02 다른 계정의 알림을 읽음 처리하면 403 FORBIDDEN, 읽음이 바뀌지 않는다', async () => {
    const owner = await createUserAccount('QA알림남의것');
    const [n] = await seedNotifications(owner.accountId, 1);
    const res = await read(u3.token, n!.id);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(
      (await prisma.notifications.findUniqueOrThrow({ where: { id: n!.id } }))
        .read_at,
    ).toBeNull();
  });

  it('NOTI-AC-03 일반·작가 토큰으로 목록을 보면 자기 알림만 온다', async () => {
    for (const account of [u1, p1, u3]) {
      const items = (await list(account.token, '?limit=50')).body.items as {
        notificationId: string;
      }[];
      const own = new Set(
        (
          await prisma.notifications.findMany({
            where: { auth_account_id: account.accountId },
            select: { id: true },
          })
        ).map(({ id }) => id),
      );
      items.forEach(({ notificationId }) =>
        expect(own.has(notificationId)).toBe(true),
      );
    }
  });
});
