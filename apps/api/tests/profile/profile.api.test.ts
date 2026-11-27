/**
 * PROFILE QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - AI 리뷰 요약은 리뷰가 3개 이상이면 응답 뒤 OpenAI 요약을 시작하므로, 3개 미만(NOT_ENOUGH)만 본다
 *   이 파일에서는 외부 요청이 나가면 테스트를 실패시킨다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder } from '../helpers.js';
import {
  DAY_MS,
  createPhotographerAccount,
  createReservationRecord,
  createUserAccount,
} from '../fixtures.js';

type Photographer = Awaited<ReturnType<typeof createPhotographerAccount>>;
type User = Awaited<ReturnType<typeof createUserAccount>>;

const recorder = createRecorder('PROFILE BE · AC');
let u1: User;
let u3: User;
let p7: Photographer;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    throw new Error(
      `테스트 중 외부 요청 차단: ${String(input instanceof Request ? input.url : input)}`,
    );
  });
  u1 = await createUserAccount('QA프로필U1');
  u3 = await createUserAccount('QA프로필U3');
  p7 = await readyPhotographer('QA프로필P7');
});

afterAll(async () => {
  fetchSpy.mockRestore();
  recorder.print();
  await prisma.$disconnect();
});

/** 기본 정보 5개를 모두 채운 작가 (준비 완료) */
async function readyPhotographer(prefix = 'QA프로필작가') {
  const photographer = await createPhotographerAccount(prefix);
  await prisma.photographers.update({
    where: { id: photographer.photographerId },
    data: {
      profile_image_url: 'qa/profile.webp',
      career: 3,
      regions: ['SEOUL', 'BUSAN'],
    },
  });
  return photographer;
}

/** 구매 확정 예약에 리뷰를 단다 (createdAt으로 최신순을 정한다) */
async function addReview(
  photographer: Photographer,
  rating: number,
  createdAt: Date,
  user: User = u1,
) {
  const reservation = await createReservationRecord({
    userId: user.userId,
    photographerId: photographer.photographerId,
    status: 'PURCHASE_CONFIRMED',
    createdAt: new Date(createdAt.getTime() - DAY_MS),
  });
  return prisma.reviews.create({
    data: {
      reservation_id: reservation.id,
      user_id: user.userId,
      photographer_id: photographer.photographerId,
      rating,
      comment: `QA 리뷰 ${rating}점`,
      created_at: createdAt,
    },
  });
}

const profile = (photographerId: string, token?: string) => {
  const req = api().get(`/photographers/${photographerId}`);
  return token ? req.set(bearer(token)) : req;
};
const photos = (photographerId: string, token?: string) => {
  const req = api().get(`/photographers/${photographerId}/photos`);
  return token ? req.set(bearer(token)) : req;
};
const reviews = (photographerId: string, query = '') =>
  api().get(`/photographers/${photographerId}/reviews${query}`);

// ---------------------------------------------------------------------------
describe('PROFILE BE · 작가 프로필 GET /photographers/{id}', () => {
  it('PROFILE-BE-01 정상 요청이면 기본 정보와 ratingAvg·reviewCount·savedCount·completedCount·saved·isSelf·isReady가 온다', async () => {
    const p = await readyPhotographer();
    await addReview(p, 5, new Date(Date.now() - 3 * DAY_MS));
    await addReview(p, 4, new Date(Date.now() - 2 * DAY_MS));
    await prisma.photographer_saves.create({
      data: { photographer_id: p.photographerId, user_id: u3.userId },
    });

    const res = await profile(p.photographerId);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: p.photographerId,
      nickname: p.nickname,
      profileImageUrl: expect.any(String),
      career: 3,
      regions: ['SEOUL', 'BUSAN'],
      categories: ['PROFILE'],
      introduction: 'QA 작가',
      ratingAvg: 4.5,
      reviewCount: 2,
      savedCount: 1,
      completedCount: 2,
      saved: false,
      isSelf: false,
      isReady: true,
    });
  });

  it('PROFILE-BE-02 UUID가 아니면 400 VALIDATION_FAILED, 없는 작가면 404 PHOTOGRAPHER_NOT_FOUND (L2-10)', async () => {
    const invalid = await profile('not-a-uuid');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    const missing = await profile(randomUUID());
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('PHOTOGRAPHER_NOT_FOUND');
  });

  it('PROFILE-BE-03 저장한 일반 토큰이면 saved: true, 비회원·다른 일반 계정이면 false, 저장 수가 1 늘어 있다 (L2-02, L2-03)', async () => {
    const p = await readyPhotographer();
    const before = (await profile(p.photographerId)).body.savedCount;
    expect(
      (
        await api()
          .put(`/photographers/${p.photographerId}/save`)
          .set(bearer(u1.token))
      ).status,
    ).toBe(200);

    expect((await profile(p.photographerId, u1.token)).body).toMatchObject({
      saved: true,
      savedCount: before + 1,
    });
    expect((await profile(p.photographerId)).body.saved).toBe(false);
    expect((await profile(p.photographerId, u3.token)).body.saved).toBe(false);
  });

  it('PROFILE-BE-R1 작가 본인이면 isSelf: true, 다른 작가면 false (L2-07)', async () => {
    const p = await readyPhotographer();
    expect((await profile(p.photographerId, p.token)).body.isSelf).toBe(true);
    expect((await profile(p.photographerId, p7.token)).body.isSelf).toBe(false);
    const mine = (await api().get('/photographers/me').set(bearer(p.token)))
      .body;
    expect(mine.id).toBe(p.photographerId);
  });

  it('PROFILE-BE-R2 통계의 리뷰 수·평점이 리뷰 목록의 개수·평균과 같다 (L2-04)', async () => {
    const p = await readyPhotographer();
    const ratings = [5, 4, 4, 3, 5];
    for (const [i, rating] of ratings.entries()) {
      await addReview(p, rating, new Date(Date.now() - (10 - i) * DAY_MS));
    }
    const stats = (await profile(p.photographerId)).body;
    const list = (await reviews(p.photographerId, '?pageSize=50')).body;
    expect(stats.reviewCount).toBe(list.totalCount);
    const avg =
      list.items.reduce(
        (sum: number, { rating }: { rating: number }) => sum + rating,
        0,
      ) / list.items.length;
    expect(stats.ratingAvg).toBe(Math.round(avg * 10) / 10);
  });
});

// ---------------------------------------------------------------------------
describe('PROFILE BE · 사진 · 상품 · 리뷰 · 요약', () => {
  it('PROFILE-BE-04 노출 기준에 못 미친 작가의 사진은 403 PHOTOGRAPHER_NOT_READY, 작가 본인 토큰이면 200 (L2-08)', async () => {
    const notReady = await createPhotographerAccount('QA프로필준비중');
    const guest = await photos(notReady.photographerId);
    expect(guest.status).toBe(403);
    expect(guest.body.code).toBe('PHOTOGRAPHER_NOT_READY');
    expect((await photos(notReady.photographerId, notReady.token)).status).toBe(
      200,
    );
    // 본인에게는 준비 중 화면이 아니라 자기 프로필이 온다
    expect(
      (await profile(notReady.photographerId, notReady.token)).body,
    ).toMatchObject({ isSelf: true, isReady: false });
  });

  it('PROFILE-BE-R3 [DQ-01 실제 동작] 경력만 비운 작가는 사진 조회·피드 노출이 되지만 프로필은 isReady: false (L2-09)', async () => {
    const p = await readyPhotographer('QA프로필경력없음');
    await prisma.photographers.update({
      where: { id: p.photographerId },
      data: { career: null },
    });
    const photo = await prisma.photos.create({
      data: {
        photographer_id: p.photographerId,
        storage_location: 'qa/career.webp',
        width: 1,
        height: 1,
      },
    });

    expect((await photos(p.photographerId)).status).toBe(200);
    const feed = (
      await api().get('/photos?sort=latest&limit=50')
    ).body.items.map(({ photoId }: { photoId: string }) => photoId);
    expect(feed).toContain(photo.id);
    expect((await profile(p.photographerId)).body.isReady).toBe(false);
  });

  it('PROFILE-BE-05 상품은 등록한 순서대로 오고, 없는 작가면 404 PHOTOGRAPHER_NOT_FOUND', async () => {
    const p = await readyPhotographer();
    const names = ['QA 30분', 'QA 60분', 'QA 90분'];
    for (const [i, name] of names.entries()) {
      await prisma.products.create({
        data: {
          photographer_id: p.photographerId,
          name,
          price: 50_000,
          duration_minutes: [30, 60, 90][i]!,
          photo_count: 10,
          includes_original: false,
          created_at: new Date(Date.now() - (3 - i) * 60_000),
        },
      });
    }
    const list = (
      await api().get(`/photographers/${p.photographerId}/products`)
    ).body.items;
    expect(list.map(({ name }: { name: string }) => name)).toEqual(names);
    expect(
      list.map(
        ({ durationMinutes }: { durationMinutes: number }) => durationMinutes,
      ),
    ).toEqual([30, 60, 90]);

    const missing = await api().get(`/photographers/${randomUUID()}/products`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('PHOTOGRAPHER_NOT_FOUND');
  });

  it('PROFILE-BE-06 리뷰는 기본 3개씩 최신순, 삭제된 리뷰는 빠진다', async () => {
    const p = await readyPhotographer();
    const created = [];
    for (let i = 0; i < 5; i++) {
      created.push(
        await addReview(p, 5, new Date(Date.now() - (10 - i) * DAY_MS)),
      );
    }
    await prisma.reviews.update({
      where: { id: created[4]!.id },
      data: { deleted_at: new Date() },
    });

    const page = (await reviews(p.photographerId)).body;
    expect(page).toMatchObject({
      page: 1,
      pageSize: 3,
      totalCount: 4,
      totalPages: 2,
    });
    expect(
      page.items.map(({ reviewId }: { reviewId: string }) => reviewId),
    ).toEqual([created[3]!.id, created[2]!.id, created[1]!.id]);
    const second = (await reviews(p.photographerId, '?page=2')).body;
    expect(
      second.items.map(({ reviewId }: { reviewId: string }) => reviewId),
    ).toEqual([created[0]!.id]);
  });

  it.each([0, 51])(
    'PROFILE-BE-07 리뷰 pageSize=%i이면 400 VALIDATION_FAILED',
    async (size) => {
      const res = await reviews(p7.photographerId, `?pageSize=${size}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it('PROFILE-BE-08 리뷰가 3개보다 적으면 요약 status: NOT_ENOUGH', async () => {
    const p = await readyPhotographer();
    await addReview(p, 5, new Date(Date.now() - DAY_MS));
    await addReview(p, 4, new Date());
    const res = await api().get(
      `/photographers/${p.photographerId}/reviews/summary`,
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NOT_ENOUGH');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('PROFILE AC · 준비 중인 작가 (비회원)', () => {
  it('PROFILE-AC-01 비회원이 준비 중인 작가의 프로필을 부른 응답 값을 기록', async () => {
    const notReady = await createPhotographerAccount('QA프로필AC');
    const res = await profile(notReady.photographerId);
    recorder.record('PROFILE-AC-01', { status: res.status, body: res.body });
  });

  it('PROFILE-AC-02 비회원이 준비 중인 작가의 사진을 부르면 403 PHOTOGRAPHER_NOT_READY', async () => {
    const notReady = await createPhotographerAccount('QA프로필AC2');
    const res = await photos(notReady.photographerId);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PHOTOGRAPHER_NOT_READY');
  });

  it('PROFILE-AC-03 비회원이 준비 중인 작가의 상품·리뷰를 부른 응답 코드와 내용을 기록', async () => {
    const notReady = await createPhotographerAccount('QA프로필AC3');
    await prisma.products.create({
      data: {
        photographer_id: notReady.photographerId,
        name: 'QA 준비 중 상품',
        price: 10_000,
        duration_minutes: 60,
        photo_count: 5,
        includes_original: false,
      },
    });
    const products = await api().get(
      `/photographers/${notReady.photographerId}/products`,
    );
    const list = await reviews(notReady.photographerId);
    recorder.record('PROFILE-AC-03', {
      products: {
        status: products.status,
        count: products.body.items?.length ?? null,
      },
      reviews: {
        status: list.status,
        totalCount: list.body.totalCount ?? null,
      },
    });
  });
});
