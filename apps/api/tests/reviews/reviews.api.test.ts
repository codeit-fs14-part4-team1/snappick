/**
 * REVIEW QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L1·L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - AI 리뷰 요약(L2-07)은 외부 LLM을 호출하므로 여기서 보지 않는다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReservationStatus } from '../../src/generated/prisma/enums.js';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder } from '../helpers.js';
import {
  DAY_MS,
  createPhotographerAccount,
  createReservationRecord,
  createUserAccount,
} from '../fixtures.js';

const recorder = createRecorder('REVIEW BE · AC');

let u1: Awaited<ReturnType<typeof createUserAccount>>;
let u3: Awaited<ReturnType<typeof createUserAccount>>;
let p1: Awaited<ReturnType<typeof createPhotographerAccount>>;
let p7: Awaited<ReturnType<typeof createPhotographerAccount>>;

beforeAll(async () => {
  u1 = await createUserAccount('QA리뷰U1');
  u3 = await createUserAccount('QA리뷰U3');
  p1 = await createPhotographerAccount('QA리뷰P1');
  p7 = await createPhotographerAccount('QA리뷰P7');
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

/** 예약 (기본: U1–P1 구매 확정) */
const reserve = (status: ReservationStatus = 'PURCHASE_CONFIRMED', user = u1) =>
  createReservationRecord({
    userId: user.userId,
    photographerId: p1.photographerId,
    status,
    createdAt: new Date(Date.now() - DAY_MS),
    shootAt: new Date(Date.now() - 10 * DAY_MS),
  });

const writeReview = (
  token: string | null,
  body: { reservationId: string; rating?: unknown; comment?: unknown },
) => {
  const req = api()
    .post('/me/reviews')
    .send({ rating: 5, comment: 'QA 좋은 촬영이었어요', ...body });
  return token ? req.set(bearer(token)) : req;
};

const replyUrl = (reviewId: string) =>
  `/photographers/me/reviews/${reviewId}/reply`;

/** 구매 확정 예약에 U1이 리뷰를 쓴다 */
async function reviewed(rating = 5) {
  const reservation = await reserve();
  const res = await writeReview(u1.token, {
    reservationId: reservation.id,
    rating,
  });
  expect(res.status).toBe(201);
  return {
    reservationId: reservation.id,
    reviewId: res.body.reviewId as string,
  };
}

const eligibleIds = async (token: string) =>
  (
    await api().get('/me/reviews/eligible?pageSize=50').set(bearer(token))
  ).body.items.map((row: { reservationId: string }) => row.reservationId);

const myReviews = async (token: string) =>
  (await api().get('/me/reviews?pageSize=50').set(bearer(token))).body;

const publicReviews = async () =>
  (await api().get(`/photographers/${p1.photographerId}/reviews?pageSize=50`))
    .body;

const profile = async () =>
  (await api().get('/photographers/me').set(bearer(p1.token))).body as {
    ratingAvg: number | null;
    reviewCount: number;
  };

// ---------------------------------------------------------------------------
describe('REVIEW BE · 리뷰 /me/reviews', () => {
  it('REVIEW-BE-01 구매 확정 예약으로 POST /me/reviews면 201', async () => {
    const reservation = await reserve();
    const res = await writeReview(u1.token, {
      reservationId: reservation.id,
      rating: 4,
      comment: '  QA 앞뒤 공백  ',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      reservationId: reservation.id,
      photographerId: p1.photographerId,
      rating: 4,
      comment: 'QA 앞뒤 공백',
    });
  });

  it.each([
    ['별점 0', { rating: 0 }],
    ['별점 6', { rating: 6 }],
    ['별점 소수', { rating: 4.5 }],
    ['내용 공백뿐', { comment: '   ' }],
    ['내용 201자', { comment: '가'.repeat(201) }],
  ])('REVIEW-BE-02 %s이면 400 VALIDATION_FAILED', async (_label, body) => {
    const reservation = await reserve();
    const res = await writeReview(u1.token, {
      reservationId: reservation.id,
      ...body,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('REVIEW-BE-02b 별점 1·5, 내용 200자는 받는다', async () => {
    for (const rating of [1, 5]) {
      const reservation = await reserve();
      const res = await writeReview(u1.token, {
        reservationId: reservation.id,
        rating,
        comment: '가'.repeat(200),
      });
      expect(res.status).toBe(201);
    }
  });

  it.each(['CONFIRMED', 'SHOOT_COMPLETED', 'DELIVERED', 'CANCELED'] as const)(
    'REVIEW-BE-03 %s 예약이면 409 RESERVATION_NOT_PURCHASE_CONFIRMED',
    async (status) => {
      const reservation = await reserve(status);
      const res = await writeReview(u1.token, {
        reservationId: reservation.id,
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('RESERVATION_NOT_PURCHASE_CONFIRMED');
    },
  );

  it('REVIEW-BE-04 리뷰를 쓴 예약에 다시 쓰면 409 REVIEW_ALREADY_EXISTS, 삭제 후 다시 쓴 응답을 기록', async () => {
    const { reservationId, reviewId } = await reviewed();
    const again = await writeReview(u1.token, { reservationId });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('REVIEW_ALREADY_EXISTS');

    const deleted = await api()
      .delete(`/me/reviews/${reviewId}`)
      .set(bearer(u1.token));
    expect(deleted.status).toBe(204);
    const afterDelete = await writeReview(u1.token, { reservationId });
    recorder.record('REVIEW-BE-04', {
      '삭제 후 다시 쓰기': `${afterDelete.status} ${afterDelete.body.code ?? ''}`,
    });
  });

  it('REVIEW-BE-05 PATCH에 바꿀 값이 없으면 400 VALIDATION_FAILED, 없는 리뷰면 404 REVIEW_NOT_FOUND', async () => {
    const { reviewId } = await reviewed();
    const empty = await api()
      .patch(`/me/reviews/${reviewId}`)
      .set(bearer(u1.token))
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('VALIDATION_FAILED');

    const missing = await api()
      .patch(`/me/reviews/${randomUUID()}`)
      .set(bearer(u1.token))
      .send({ rating: 3 });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('REVIEW_NOT_FOUND');
  });

  it('REVIEW-BE-06 /me/reviews/eligible에는 구매 확정이면서 리뷰를 쓰지 않은 예약만 온다', async () => {
    const user = await createUserAccount('QA리뷰작성가능');
    const pending = await reserve('PURCHASE_CONFIRMED', user);
    const written = await reserve('PURCHASE_CONFIRMED', user);
    await writeReview(user.token, { reservationId: written.id });
    const notConfirmed = await Promise.all(
      (['CONFIRMED', 'SHOOT_COMPLETED', 'DELIVERED', 'CANCELED'] as const).map(
        (status) => reserve(status, user),
      ),
    );

    const ids = await eligibleIds(user.token);
    expect(ids).toEqual([pending.id]);
    notConfirmed.forEach(({ id }) => expect(ids).not.toContain(id));
  });

  it('REVIEW-BE-R1 리뷰를 쓰면 작성 가능에서 빠지고 작성한 리뷰에 보인다 (L2-01)', async () => {
    const user = await createUserAccount('QA리뷰탭');
    const reservation = await reserve('PURCHASE_CONFIRMED', user);
    expect(await eligibleIds(user.token)).toEqual([reservation.id]);
    expect((await myReviews(user.token)).totalCount).toBe(0);

    await writeReview(user.token, { reservationId: reservation.id });
    expect(await eligibleIds(user.token)).toEqual([]);
    const mine = await myReviews(user.token);
    expect(mine.totalCount).toBe(1);
    expect(mine.items[0]).toMatchObject({
      reservationId: reservation.id,
      photographer: { nickname: p1.nickname },
    });
  });

  it('REVIEW-BE-R2 리뷰를 쓰면 작가 프로필의 리뷰 맨 위에 보이고 리뷰 수·평점이 바뀐다 (L2-02)', async () => {
    const before = await profile();
    const { reviewId } = await reviewed(1);
    const after = await profile();
    expect(after.reviewCount).toBe(before.reviewCount + 1);
    if (before.ratingAvg !== null) {
      expect(after.ratingAvg).toBeLessThan(before.ratingAvg);
    }
    expect((await publicReviews()).items[0].reviewId).toBe(reviewId);
  });

  it('REVIEW-BE-R3 리뷰를 수정하면 작가 프로필에 고친 별점·내용이 보인다 (L2-03)', async () => {
    const { reviewId } = await reviewed(5);
    const res = await api()
      .patch(`/me/reviews/${reviewId}`)
      .set(bearer(u1.token))
      .send({ rating: 2, comment: 'QA 수정한 내용' });
    expect(res.status).toBe(200);
    const item = (await publicReviews()).items.find(
      (row: { reviewId: string }) => row.reviewId === reviewId,
    );
    expect(item).toMatchObject({ rating: 2, comment: 'QA 수정한 내용' });
  });

  it('REVIEW-BE-R4 리뷰를 삭제하면 프로필에서 사라지고 리뷰 수가 줄며, 작성 가능에 다시 나오지 않는다 (L2-04)', async () => {
    const { reservationId, reviewId } = await reviewed();
    const before = await profile();
    await api().delete(`/me/reviews/${reviewId}`).set(bearer(u1.token));
    expect((await profile()).reviewCount).toBe(before.reviewCount - 1);
    expect(
      (await publicReviews()).items.map(
        (row: { reviewId: string }) => row.reviewId,
      ),
    ).not.toContain(reviewId);
    expect(await eligibleIds(u1.token)).not.toContain(reservationId);
  });

  it('REVIEW-BE-R5 리뷰 내역 기본 pageSize를 기록 (QA 문서: 한 페이지 5개)', async () => {
    const page = (await api().get('/me/reviews').set(bearer(u1.token))).body;
    const eligible = (
      await api().get('/me/reviews/eligible').set(bearer(u1.token))
    ).body;
    recorder.record('REVIEW-BE-R5', {
      '/me/reviews': page.pageSize,
      '/me/reviews/eligible': eligible.pageSize,
    });
  });

  it('REVIEW-BE-R6 같은 예약에 리뷰를 동시에 등록하면 하나만 생기고 늦은 쪽은 409 (L2-08)', async () => {
    const reservation = await reserve();
    const results = await Promise.all([
      writeReview(u1.token, { reservationId: reservation.id }),
      writeReview(u1.token, { reservationId: reservation.id }),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(results.find(({ status }) => status === 409)?.body.code).toBe(
      'REVIEW_ALREADY_EXISTS',
    );
    expect(
      await prisma.reviews.count({ where: { reservation_id: reservation.id } }),
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('REVIEW BE · 답글 /photographers/me/reviews/{id}/reply', () => {
  const reply = (
    reviewId: string,
    token: string,
    comment: unknown = 'QA 감사합니다',
  ) => api().post(replyUrl(reviewId)).set(bearer(token)).send({ comment });

  it('REVIEW-BE-07 답글은 처음 201, 두 번째는 409 REPLY_ALREADY_EXISTS, 1,001자면 400 VALIDATION_FAILED', async () => {
    const { reviewId } = await reviewed();
    expect((await reply(reviewId, p1.token)).status).toBe(201);
    const second = await reply(reviewId, p1.token);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('REPLY_ALREADY_EXISTS');

    const other = (await reviewed()).reviewId;
    for (const comment of ['가'.repeat(1001), '   ']) {
      const res = await reply(other, p1.token, comment);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
    expect((await reply(other, p1.token, '가'.repeat(1000))).status).toBe(201);
  });

  it('REVIEW-BE-08 답글이 없는 리뷰에 수정·삭제하면 404 REPLY_NOT_FOUND', async () => {
    const { reviewId } = await reviewed();
    const patch = await api()
      .patch(replyUrl(reviewId))
      .set(bearer(p1.token))
      .send({ comment: 'QA' });
    const del = await api().delete(replyUrl(reviewId)).set(bearer(p1.token));
    for (const res of [patch, del]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('REPLY_NOT_FOUND');
    }
  });

  it('REVIEW-BE-R7 작가가 답글을 쓰면 일반 계정의 리뷰 내역에 보이고, 수정·삭제가 반영된다 (L2-05)', async () => {
    const { reviewId } = await reviewed();
    const find = async () =>
      (await myReviews(u1.token)).items.find(
        (row: { reviewId: string }) => row.reviewId === reviewId,
      ).reply;

    await reply(reviewId, p1.token, 'QA 첫 답글');
    expect(await find()).toMatchObject({ comment: 'QA 첫 답글' });

    const updated = await api()
      .patch(replyUrl(reviewId))
      .set(bearer(p1.token))
      .send({ comment: 'QA 고친 답글' });
    expect(updated.status).toBe(200);
    expect(await find()).toMatchObject({ comment: 'QA 고친 답글' });

    const deleted = await api()
      .delete(replyUrl(reviewId))
      .set(bearer(p1.token));
    expect(deleted.status).toBe(204);
    expect(await find()).toBeNull();

    // 삭제한 답글은 다시 쓸 수 있다
    expect((await reply(reviewId, p1.token, 'QA 다시 쓴 답글')).status).toBe(
      201,
    );
    expect(await find()).toMatchObject({ comment: 'QA 다시 쓴 답글' });
  });

  it('REVIEW-BE-R8 답글이 달린 리뷰를 삭제하면 프로필에서 리뷰와 답글이 함께 사라진다 (L2-06)', async () => {
    const { reviewId } = await reviewed();
    await reply(reviewId, p1.token);
    await api().delete(`/me/reviews/${reviewId}`).set(bearer(u1.token));
    expect(
      (await publicReviews()).items.map(
        (row: { reviewId: string }) => row.reviewId,
      ),
    ).not.toContain(reviewId);
    // 삭제된 리뷰의 답글은 수정할 수 없다
    const patch = await api()
      .patch(replyUrl(reviewId))
      .set(bearer(p1.token))
      .send({ comment: 'QA' });
    expect(patch.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe('REVIEW AC · 접근 제어', () => {
  it('REVIEW-AC-01 비회원이 /me/reviews 요청하면 401 UNAUTHORIZED', async () => {
    for (const res of [
      await api().get('/me/reviews'),
      await api().get('/me/reviews/eligible'),
      await writeReview(null, { reservationId: randomUUID() }),
      await api().patch(`/me/reviews/${randomUUID()}`).send({ rating: 3 }),
      await api().delete(`/me/reviews/${randomUUID()}`),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('REVIEW-AC-02 작가 토큰으로 리뷰 POST, 일반 토큰으로 답글 POST면 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    const reservation = await reserve();
    const byPhotographer = await writeReview(p1.token, {
      reservationId: reservation.id,
    });
    const { reviewId } = await reviewed();
    const byUser = await api()
      .post(replyUrl(reviewId))
      .set(bearer(u1.token))
      .send({ comment: 'QA' });
    for (const res of [byPhotographer, byUser]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
    }
  });

  it('REVIEW-AC-03 다른 계정의 리뷰를 PATCH·DELETE하면 404 REVIEW_NOT_FOUND', async () => {
    const { reviewId } = await reviewed();
    const patch = await api()
      .patch(`/me/reviews/${reviewId}`)
      .set(bearer(u3.token))
      .send({ rating: 1 });
    const del = await api()
      .delete(`/me/reviews/${reviewId}`)
      .set(bearer(u3.token));
    for (const res of [patch, del]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('REVIEW_NOT_FOUND');
    }
    const review = await prisma.reviews.findUniqueOrThrow({
      where: { id: reviewId },
    });
    expect(review).toMatchObject({ rating: 5, deleted_at: null });
  });

  it('REVIEW-AC-04 다른 계정의 예약으로 POST /me/reviews면 404 RESERVATION_NOT_FOUND', async () => {
    const reservation = await reserve('PURCHASE_CONFIRMED', u1);
    const res = await writeReview(u3.token, { reservationId: reservation.id });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESERVATION_NOT_FOUND');
  });

  it('REVIEW-AC-05 다른 작가가 받은 리뷰에 답글 POST한 응답 코드와 답글 생성 여부를 기록', async () => {
    const { reviewId } = await reviewed();
    const res = await api()
      .post(replyUrl(reviewId))
      .set(bearer(p7.token))
      .send({ comment: 'QA 남의 리뷰 답글' });
    recorder.record('REVIEW-AC-05', {
      status: res.status,
      code: res.body.code,
      답글생성:
        (await prisma.review_replies.count({
          where: { review_id: reviewId },
        })) > 0,
    });
  });
});
