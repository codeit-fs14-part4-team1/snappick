/**
 * INQUIRY QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - BE-12(탈퇴 상대)는 문서에서 1차 보류지만, 테스트 DB에서는 채팅방의 사용자를 비워 바로 만들 수 있어 넣었다
 * - AC-05(화면에서 남의 방 주소 열기)는 화면 동작이라 여기서 보지 않는다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer } from '../helpers.js';
import { createPhotographerAccount, createUserAccount } from '../fixtures.js';

type Account = Awaited<ReturnType<typeof createUserAccount>>;
type Photographer = Awaited<ReturnType<typeof createPhotographerAccount>>;

let u1: Account;
let u3: Account;
let p1: Photographer;
let p7: Photographer;

/** 문의를 받을 수 있는 작가 (프로필 사진·소개·지역·카테고리, 경력은 비움) */
async function readyPhotographer(prefix: string) {
  const photographer = await createPhotographerAccount(prefix);
  await prisma.photographers.update({
    where: { id: photographer.photographerId },
    data: { profile_image_url: 'qa/profile.webp', career: null },
  });
  return photographer;
}

beforeAll(async () => {
  u1 = await createUserAccount('QA문의U1');
  u3 = await createUserAccount('QA문의U3');
  p1 = await readyPhotographer('QA문의P1');
  p7 = await readyPhotographer('QA문의P7');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const startChat = (token: string | null, photographerId: unknown) => {
  const req = api().post('/chats').send({ photographerId });
  return token ? req.set(bearer(token)) : req;
};

const send = (
  roomId: string,
  token: string | null,
  body: Record<string, unknown>,
) => {
  const req = api().post(`/chats/${roomId}/messages`).send(body);
  return token ? req.set(bearer(token)) : req;
};
const text = (roomId: string, token: string, content: unknown) =>
  send(roomId, token, { messageType: 'TEXT', content });
const inquiry = (
  roomId: string,
  token: string,
  payload: Record<string, unknown>,
) => send(roomId, token, { messageType: 'INITIAL_REQUEST', payload });

const messages = (roomId: string, token: string | null, query = '') => {
  const req = api().get(`/chats/${roomId}/messages${query}`);
  return token ? req.set(bearer(token)) : req;
};
const markRead = (
  roomId: string,
  token: string | null,
  body: Record<string, unknown>,
) => {
  const req = api().patch(`/chats/${roomId}/read`).send(body);
  return token ? req.set(bearer(token)) : req;
};
const chatList = async (token: string) =>
  (await api().get('/chats').set(bearer(token))).body.items as {
    id: string;
    partner: { nickname: string | null; isWithdrawn: boolean };
    unreadCount: number;
    lastMessage: { content: string } | null;
  }[];

/** 새 일반 계정이 작가와 연 새 방 */
async function newRoom(photographer: Photographer = p1) {
  const user = await createUserAccount('QA문의방');
  const res = await startChat(user.token, photographer.photographerId);
  expect(res.status).toBe(201);
  return { user, roomId: res.body.chatRoomId as string };
}

const INQUIRY_PAYLOAD = {
  date: '2027-01-15',
  timeSlot: 'AFTERNOON',
  region: 'SEOUL',
  location: '성수동 카페거리',
  concept: ['NATURAL', 'FILM'],
  category: 'PROFILE',
};

// ---------------------------------------------------------------------------
describe('INQUIRY BE · 문의 시작 POST /chats', () => {
  it('INQUIRY-BE-01 새 작가면 201과 채팅방 id, 이미 방이 있으면 200과 같은 id (L2-02)', async () => {
    const first = await startChat(u1.token, p1.photographerId);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      isNew: true,
      photographer: { id: p1.photographerId, nickname: p1.nickname },
    });
    const again = await startChat(u1.token, p1.photographerId);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({
      chatRoomId: first.body.chatRoomId,
      isNew: false,
    });
  });

  it('INQUIRY-BE-R1 [문의하기]를 동시에 여러 번 보내도 방은 하나만 생긴다 (L2-10)', async () => {
    const user = await createUserAccount('QA문의연타');
    const results = await Promise.all(
      [1, 2, 3].map(() => startChat(user.token, p7.photographerId)),
    );
    results.forEach(({ status }) => expect([200, 201]).toContain(status));
    expect(new Set(results.map(({ body }) => body.chatRoomId)).size).toBe(1);
    expect(
      await prisma.chat_rooms.count({
        where: { user_id: user.userId, photographer_id: p7.photographerId },
      }),
    ).toBe(1);
  });

  it('INQUIRY-BE-02 작가 토큰이면 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    const res = await startChat(p7.token, p1.photographerId);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
  });

  it('INQUIRY-BE-03 photographerId가 UUID가 아니면 400 VALIDATION_FAILED, 없는 작가면 404 PHOTOGRAPHER_NOT_FOUND', async () => {
    const invalid = await startChat(u1.token, 'not-a-uuid');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    const missing = await startChat(u1.token, randomUUID());
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('PHOTOGRAPHER_NOT_FOUND');
  });

  it.each([
    ['프로필 사진 없음', { profile_image_url: null }],
    ['소개 없음', { introduction: null }],
    ['지역 없음', { regions: [] }],
    ['카테고리 없음', { categories: [] }],
  ])(
    'INQUIRY-BE-04 준비가 안 된 작가(%s)면 400 PHOTOGRAPHER_NOT_READY',
    async (_label, data) => {
      const photographer = await readyPhotographer('QA준비안됨');
      await prisma.photographers.update({
        where: { id: photographer.photographerId },
        data,
      });
      const res = await startChat(u1.token, photographer.photographerId);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PHOTOGRAPHER_NOT_READY');
    },
  );
});

// ---------------------------------------------------------------------------
describe('INQUIRY BE · 메시지 POST·GET /chats/{id}/messages', () => {
  it('INQUIRY-BE-05 일반 메시지는 201, 공백만이면 400 EMPTY_MESSAGE_CONTENT, 1,001자면 400 MESSAGE_TOO_LONG', async () => {
    const { user, roomId } = await newRoom();
    expect((await text(roomId, user.token, 'QA 안녕하세요')).status).toBe(201);
    expect((await text(roomId, user.token, '가'.repeat(1000))).status).toBe(
      201,
    );

    const blank = await text(roomId, user.token, '   ');
    expect(blank.status).toBe(400);
    expect(blank.body.code).toBe('EMPTY_MESSAGE_CONTENT');
    const tooLong = await text(roomId, user.token, '가'.repeat(1001));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.code).toBe('MESSAGE_TOO_LONG');
  });

  it('INQUIRY-BE-06 촬영 정보는 처음 201, 같은 방에서 두 번째는 409 INITIAL_REQUEST_ALREADY_SENT', async () => {
    const { user, roomId } = await newRoom();
    const first = await inquiry(roomId, user.token, INQUIRY_PAYLOAD);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      messageType: 'INITIAL_REQUEST',
      payload: INQUIRY_PAYLOAD,
    });
    const second = await inquiry(roomId, user.token, { category: 'WEDDING' });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('INITIAL_REQUEST_ALREADY_SENT');
  });

  it('INQUIRY-BE-R2 같은 방에 촬영 정보를 동시에 보내면 카드는 한 장만 생기고 늦은 쪽은 409 (L2-11)', async () => {
    const { user, roomId } = await newRoom();
    const results = await Promise.all([
      inquiry(roomId, user.token, INQUIRY_PAYLOAD),
      inquiry(roomId, user.token, INQUIRY_PAYLOAD),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(results.find(({ status }) => status === 409)?.body.code).toBe(
      'INITIAL_REQUEST_ALREADY_SENT',
    );
    expect(
      await prisma.chat_messages.count({
        where: { chat_room_id: roomId, message_type: 'INITIAL_REQUEST' },
      }),
    ).toBe(1);
  });

  it.each([
    ['모두 비어 있음', {}],
    ['시간대가 미정뿐', { timeSlot: 'UNDECIDED' }],
    ['빈 배열·빈 문자열', { concept: [], location: '   ' }],
  ])(
    'INQUIRY-BE-07 촬영 정보가 %s이면 400 EMPTY_INITIAL_REQUEST',
    async (_label, payload) => {
      const { user, roomId } = await newRoom();
      const res = await inquiry(roomId, user.token, payload);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('EMPTY_INITIAL_REQUEST');
    },
  );

  it('INQUIRY-BE-08 작가 토큰으로 촬영 정보를 보내면 403 CHAT_ROOM_ACCESS_DENIED', async () => {
    const { roomId } = await newRoom();
    const res = await inquiry(roomId, p1.token, INQUIRY_PAYLOAD);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CHAT_ROOM_ACCESS_DENIED');
  });

  it('INQUIRY-BE-09 없는 방이면 404 CHAT_ROOM_NOT_FOUND', async () => {
    const roomId = randomUUID();
    for (const res of [
      await text(roomId, u1.token, 'QA'),
      await inquiry(roomId, u1.token, INQUIRY_PAYLOAD),
      await messages(roomId, u1.token),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CHAT_ROOM_NOT_FOUND');
    }
  });

  it('INQUIRY-BE-10 메시지 조회 limit 기본 30, 101이면 400 VALIDATION_FAILED, 이전 페이지가 날짜 순서로 이어진다 (L2-08)', async () => {
    const { user, roomId } = await newRoom();
    const base = Date.now() - 60 * 60 * 1000;
    await prisma.chat_messages.createMany({
      data: Array.from({ length: 35 }, (_, i) => ({
        chat_room_id: roomId,
        recipient_account_id: p1.accountId,
        message_type: 'TEXT' as const,
        content: `QA 메시지 ${i + 1}`,
        created_at: new Date(base + i * 1000),
      })),
    });

    const latest = (await messages(roomId, user.token)).body;
    expect(latest.items).toHaveLength(30);
    expect(latest.hasNext).toBe(true);
    const older = (
      await messages(roomId, user.token, `?cursor=${latest.nextCursor}`)
    ).body;
    expect(older.items).toHaveLength(5);
    expect(older.hasNext).toBe(false);

    // 이전 페이지 + 최근 페이지 = 오래된 순서 1~35, 겹침 없음
    const contents = [...older.items, ...latest.items].map(
      ({ content }: { content: string }) => content,
    );
    expect(contents).toEqual(
      Array.from({ length: 35 }, (_, i) => `QA 메시지 ${i + 1}`),
    );

    const tooLarge = await messages(roomId, user.token, '?limit=101');
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body.code).toBe('VALIDATION_FAILED');
  });

  it('INQUIRY-BE-12 탈퇴한 상대가 있는 방에 메시지를 보내면 422 PARTNER_WITHDRAWN (문서 1차 보류, 테스트 DB로 확인)', async () => {
    const { user, roomId } = await newRoom();
    await text(roomId, user.token, 'QA 탈퇴 전 메시지');
    await prisma.chat_rooms.update({
      where: { id: roomId },
      data: { user_id: null },
    });
    const res = await text(roomId, p1.token, 'QA 탈퇴 후 메시지');
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PARTNER_WITHDRAWN');
    // 목록에는 탈퇴한 상대로 보인다 (L1-09 서버 쪽)
    const room = (await chatList(p1.token)).find(({ id }) => id === roomId);
    expect(room?.partner).toMatchObject({ nickname: null, isWithdrawn: true });
  });

  it.each([
    ['상세 장소 51자', { location: '가'.repeat(51) }],
    [
      '콘셉트 6개',
      {
        concept: [
          'NATURAL',
          'BRIGHT',
          'FILM',
          'VINTAGE',
          'CINEMATIC',
          'MONOCHROME',
        ],
      },
    ],
  ])(
    'INQUIRY-BE-13 새 채팅방에서 촬영 정보의 %s이면 400이고 촬영 문의가 생성되지 않는다',
    async (_label, payload) => {
      const { user, roomId } = await newRoom();
      const res = await inquiry(roomId, user.token, {
        region: 'SEOUL',
        ...payload,
      });
      expect(res.status).toBe(400);
      expect(
        await prisma.chat_messages.count({
          where: { chat_room_id: roomId, message_type: 'INITIAL_REQUEST' },
        }),
      ).toBe(0);
    },
  );
});

// ---------------------------------------------------------------------------
describe('INQUIRY BE · 읽음 PATCH /chats/{id}/read', () => {
  it('INQUIRY-BE-11 lastReadMessageId를 보내면 200, UUID가 아니면 400 INVALID_REQUEST_BODY', async () => {
    const { user, roomId } = await newRoom();
    const sent = (await text(roomId, user.token, 'QA 읽어 주세요')).body;
    const res = await markRead(roomId, p1.token, {
      lastReadMessageId: sent.id,
    });
    expect(res.status).toBe(200);
    const invalid = await markRead(roomId, p1.token, {
      lastReadMessageId: 'not-a-uuid',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('INVALID_REQUEST_BODY');
  });

  it('INQUIRY-BE-R3 읽음 처리하면 목록의 안 읽은 수가 사라지고 내 메시지의 read_at이 채워진다 (L2-05, L2-06)', async () => {
    const { user, roomId } = await newRoom();
    await text(roomId, user.token, 'QA 첫 번째');
    const last = (await text(roomId, user.token, 'QA 두 번째')).body;
    expect(
      (await chatList(p1.token)).find(({ id }) => id === roomId)?.unreadCount,
    ).toBe(2);

    await markRead(roomId, p1.token, { lastReadMessageId: last.id });
    expect(
      (await chatList(p1.token)).find(({ id }) => id === roomId)?.unreadCount,
    ).toBe(0);
    const unread = await prisma.chat_messages.count({
      where: {
        chat_room_id: roomId,
        recipient_account_id: p1.accountId,
        read_at: null,
      },
    });
    expect(unread).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('INQUIRY BE · 목록 반영 GET /chats', () => {
  it('INQUIRY-BE-R4 작가의 받은 문의에는 메시지가 있는 방만 보이고, 촬영 정보를 보내면 나타난다 (L2-03)', async () => {
    const { user, roomId } = await newRoom();
    expect((await chatList(p1.token)).map(({ id }) => id)).not.toContain(
      roomId,
    );
    // 일반 계정 목록에는 메시지가 없어도 보인다
    expect((await chatList(user.token)).map(({ id }) => id)).toContain(roomId);

    await inquiry(roomId, user.token, INQUIRY_PAYLOAD);
    expect((await chatList(p1.token)).map(({ id }) => id)).toContain(roomId);
  });

  it('INQUIRY-BE-R5 새 메시지가 오면 그 방이 목록 맨 위로 올라가고 미리보기가 바뀐다 (L2-07)', async () => {
    const user = await createUserAccount('QA문의정렬');
    const roomA = (await startChat(user.token, p1.photographerId)).body
      .chatRoomId;
    const roomB = (await startChat(user.token, p7.photographerId)).body
      .chatRoomId;
    await text(roomA, user.token, 'QA A방');
    await text(roomB, user.token, 'QA B방');
    expect(
      (await chatList(user.token)).map(({ id }) => id).slice(0, 2),
    ).toEqual([roomB, roomA]);

    await text(roomA, user.token, 'QA A방 새 메시지');
    const list = await chatList(user.token);
    expect(list.map(({ id }) => id).slice(0, 2)).toEqual([roomA, roomB]);
    expect(list[0]?.lastMessage?.content).toBe('QA A방 새 메시지');
  });

  it('INQUIRY-BE-R6 다른 계정의 목록에는 내 방이 보이지 않는다 (L2-13)', async () => {
    const { user, roomId } = await newRoom();
    await text(roomId, user.token, 'QA');
    expect((await chatList(u3.token)).map(({ id }) => id)).not.toContain(
      roomId,
    );
    expect((await chatList(p7.token)).map(({ id }) => id)).not.toContain(
      roomId,
    );
  });
});

// ---------------------------------------------------------------------------
describe('INQUIRY AC · 접근 제어', () => {
  it('INQUIRY-AC-01 비회원이 GET /chats면 401 UNAUTHORIZED', async () => {
    const res = await api().get('/chats');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('INQUIRY-AC-02·03·04 다른 사람의 방 메시지 조회·보내기·읽음 처리는 403 CHAT_ROOM_ACCESS_DENIED', async () => {
    const { user, roomId } = await newRoom();
    const sent = (await text(roomId, user.token, 'QA 당사자 메시지')).body;
    for (const token of [u3.token, p7.token]) {
      for (const res of [
        await messages(roomId, token),
        await text(roomId, token, 'QA 남의 방'),
        await markRead(roomId, token, { lastReadMessageId: sent.id }),
      ]) {
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('CHAT_ROOM_ACCESS_DENIED');
      }
    }
    expect(
      await prisma.chat_messages.count({ where: { chat_room_id: roomId } }),
    ).toBe(1);
  });
});
