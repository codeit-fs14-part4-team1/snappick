/**
 * GUEST QA 체크리스트: AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - 문서의 L1·L2(로그인 안내 모달, 버튼 동작)는 화면 동작이라 여기서 보지 않는다
 * - 401만이 아니라 비회원 요청 뒤 좋아요 수·저장 수·채팅방이 그대로인지도 확인한다
 *   (L2-01·03·04의 "그대로다"를 서버 쪽에서 보는 것)
 * - AC-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, expiredToken } from '../helpers.js';
import { createPhotographerAccount } from '../fixtures.js';

let photoId = '';
let photographerId = '';
let photographerAccountId = '';

beforeAll(async () => {
  const photographer = await createPhotographerAccount('QA비회원P1');
  photographerId = photographer.photographerId;
  photographerAccountId = photographer.accountId;
  photoId = (
    await prisma.photos.create({
      data: {
        photographer_id: photographerId,
        storage_location: 'qa/guest.webp',
        width: 100,
        height: 100,
      },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const expectUnauthorized = (res: {
  status: number;
  body: { code?: string };
}) => {
  expect(res.status).toBe(401);
  expect(res.body.code).toBe('UNAUTHORIZED');
};

describe('GUEST AC · 접근 제어', () => {
  it('GUEST-AC-01 비회원이 PUT·DELETE /photos/{id}/like면 401 UNAUTHORIZED, 좋아요 수는 그대로다 (L2-01)', async () => {
    const before = await prisma.photo_likes.count({
      where: { photo_id: photoId },
    });
    expectUnauthorized(await api().put(`/photos/${photoId}/like`));
    expectUnauthorized(await api().delete(`/photos/${photoId}/like`));
    expect(
      await prisma.photo_likes.count({ where: { photo_id: photoId } }),
    ).toBe(before);
  });

  it('GUEST-AC-02 비회원이 PUT·DELETE /photographers/{id}/save면 401 UNAUTHORIZED, 저장 수는 그대로다 (L2-03)', async () => {
    const before = await prisma.photographer_saves.count({
      where: { photographer_id: photographerId },
    });
    expectUnauthorized(
      await api().put(`/photographers/${photographerId}/save`),
    );
    expectUnauthorized(
      await api().delete(`/photographers/${photographerId}/save`),
    );
    expect(
      await prisma.photographer_saves.count({
        where: { photographer_id: photographerId },
      }),
    ).toBe(before);
  });

  it('GUEST-AC-03 비회원이 POST /chats면 401 UNAUTHORIZED, 채팅방이 만들어지지 않는다 (L2-04)', async () => {
    const before = await prisma.chat_rooms.count({
      where: { photographer_id: photographerId },
    });
    expectUnauthorized(await api().post('/chats').send({ photographerId }));
    expect(
      await prisma.chat_rooms.count({
        where: { photographer_id: photographerId },
      }),
    ).toBe(before);
  });

  it('GUEST-AC-R1 만료·위조 토큰도 좋아요·저장·문의는 401 UNAUTHORIZED (L2-11·12 서버 쪽)', async () => {
    for (const token of [
      expiredToken(photographerAccountId),
      'not-a-jwt',
      'forged.token.value',
    ]) {
      const auth = { Authorization: `Bearer ${token}` };
      expectUnauthorized(await api().put(`/photos/${photoId}/like`).set(auth));
      expectUnauthorized(
        await api().put(`/photographers/${photographerId}/save`).set(auth),
      );
      expectUnauthorized(
        await api().post('/chats').set(auth).send({ photographerId }),
      );
    }
  });
});
