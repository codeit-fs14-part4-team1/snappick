/**
 * DETAIL QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - 사진·리뷰는 테스트 전용 작가에게 DB로 직접 만든다 (개수·순서·평점을 정확히 보려고)
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer } from '../helpers.js';
import {
  DAY_MS,
  createPhotographerAccount,
  createReservationRecord,
  createUserAccount,
} from '../fixtures.js';

type Photographer = Awaited<ReturnType<typeof createPhotographerAccount>>;
type User = Awaited<ReturnType<typeof createUserAccount>>;

let u1: User;
let u3: User;
let p1: Photographer;
let p7: Photographer;
let p1Photos: string[] = [];

/** 기본 정보를 다 채운 작가 */
async function readyPhotographer(prefix: string) {
  const photographer = await createPhotographerAccount(prefix);
  await prisma.photographers.update({
    where: { id: photographer.photographerId },
    data: { profile_image_url: 'qa/profile.webp', career: 3 },
  });
  return photographer;
}

/** count장을 1분 간격으로 만든다 (마지막 사진이 가장 최근) */
async function createPhotos(photographerId: string, count: number) {
  const ids: string[] = [];
  const base = Date.now() - count * 60_000;
  for (let i = 0; i < count; i++) {
    ids.push(
      (
        await prisma.photos.create({
          data: {
            photographer_id: photographerId,
            storage_location: `qa/detail-${randomUUID()}.webp`,
            width: 100,
            height: 100,
            categories: ['PROFILE'],
            created_at: new Date(base + i * 60_000),
          },
        })
      ).id,
    );
  }
  return ids;
}

async function addReview(photographer: Photographer, rating: number) {
  const reservation = await createReservationRecord({
    userId: u1.userId,
    photographerId: photographer.photographerId,
    status: 'PURCHASE_CONFIRMED',
    createdAt: new Date(Date.now() - DAY_MS),
  });
  return prisma.reviews.create({
    data: {
      reservation_id: reservation.id,
      user_id: u1.userId,
      photographer_id: photographer.photographerId,
      rating,
      comment: 'QA',
    },
  });
}

beforeAll(async () => {
  u1 = await createUserAccount('QA상세U1');
  u3 = await createUserAccount('QA상세U3');
  p1 = await readyPhotographer('QA상세P1');
  p7 = await readyPhotographer('QA상세P7');
  p1Photos = await createPhotos(p1.photographerId, 12);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const detail = (photoId: string, token?: string) => {
  const req = api().get(`/photos/${photoId}`);
  return token ? req.set(bearer(token)) : req;
};
const others = (photographerId: string, query = '', token?: string) => {
  const req = api().get(`/photographers/${photographerId}/photos${query}`);
  return token ? req.set(bearer(token)) : req;
};

// ---------------------------------------------------------------------------
describe('DETAIL BE · 사진 상세 GET /photos/{id}', () => {
  it('DETAIL-BE-01 비로그인이면 200, liked: false (AC-01)', async () => {
    await prisma.photo_likes.create({
      data: { user_id: u3.userId, photo_id: p1Photos[0]! },
    });
    const res = await detail(p1Photos[0]!);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      photoId: p1Photos[0],
      liked: false,
      likeCount: 1,
    });
  });

  it('DETAIL-BE-02 일반 토큰이면 그 사용자가 좋아요한 사진만 liked: true', async () => {
    await prisma.photo_likes.create({
      data: { user_id: u1.userId, photo_id: p1Photos[1]! },
    });
    expect((await detail(p1Photos[1]!, u1.token)).body.liked).toBe(true);
    expect((await detail(p1Photos[2]!, u1.token)).body.liked).toBe(false);
    // 다른 사람이 좋아요한 사진은 false
    expect((await detail(p1Photos[0]!, u1.token)).body.liked).toBe(false);
  });

  it('DETAIL-BE-03 작가 토큰이면 liked: false, 자기 사진도 (DQ-04)', async () => {
    await prisma.photo_likes.create({
      data: { user_id: u1.userId, photo_id: p1Photos[3]! },
    });
    expect((await detail(p1Photos[3]!, p7.token)).body.liked).toBe(false);
    expect((await detail(p1Photos[3]!, p1.token)).body.liked).toBe(false);
  });

  it('DETAIL-BE-04 ratingAvg는 소수 첫째 자리로 반올림, 리뷰가 없으면 null (L1-21·22)', async () => {
    const rated = await readyPhotographer('QA상세평점');
    // 12개 합 47 → 평균 3.9166… (QA 문서 TD-5의 3.92와 비슷한 소수 평점) → 3.9로 반올림
    for (const rating of [5, 4, 4, 4, 3, 3, 5, 4, 4, 4, 3, 4])
      await addReview(rated, rating);
    const [photo] = await createPhotos(rated.photographerId, 1);
    const body = (await detail(photo!)).body;
    expect(body.photographer.ratingAvg).toBe(3.9);
    expect(body.photographer.reviewCount).toBe(12);

    const [noReview] = await createPhotos(p7.photographerId, 1);
    expect((await detail(noReview!)).body.photographer).toMatchObject({
      ratingAvg: null,
      reviewCount: 0,
    });
  });

  it('DETAIL-BE-05 reviewCount에 삭제된 리뷰는 들어가지 않는다', async () => {
    const photographer = await readyPhotographer('QA상세삭제리뷰');
    const kept = await addReview(photographer, 5);
    const removed = await addReview(photographer, 1);
    await prisma.reviews.update({
      where: { id: removed.id },
      data: { deleted_at: new Date() },
    });
    const [photo] = await createPhotos(photographer.photographerId, 1);
    const body = (await detail(photo!)).body;
    expect(body.photographer).toMatchObject({ reviewCount: 1, ratingAvg: 5 });
    expect(kept.id).toBeTruthy();
  });

  it('DETAIL-BE-06 keywords는 입력한 순서대로 오고, 카테고리·설명·스타일이 그대로 온다 (L2-07)', async () => {
    const photo = await prisma.photos.create({
      data: {
        photographer_id: p1.photographerId,
        storage_location: `qa/detail-${randomUUID()}.webp`,
        width: 100,
        height: 100,
        categories: ['WEDDING', 'COUPLE'],
        styles: ['NATURAL', 'FILM', 'VINTAGE'],
        description: 'QA 꽉 찬 사진',
        photoKeyword: {
          create: [{ keyword: '셋' }, { keyword: '하나' }, { keyword: '둘' }],
        },
      },
    });
    expect((await detail(photo.id)).body).toMatchObject({
      categories: ['WEDDING', 'COUPLE'],
      styles: ['NATURAL', 'FILM', 'VINTAGE'],
      keywords: ['셋', '하나', '둘'],
      description: 'QA 꽉 찬 사진',
    });
  });

  it('DETAIL-BE-07 없는 UUID면 404 PHOTO_NOT_FOUND (L2-18·20)', async () => {
    const res = await detail(randomUUID());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PHOTO_NOT_FOUND');
  });

  it('DETAIL-BE-08 UUID 형식이 아니면 400 VALIDATION_FAILED (L2-19)', async () => {
    const res = await detail('abc');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('DETAIL-BE-09 [DQ-05 실제 동작] 준비 중 작가의 사진도 200 (L2-21)', async () => {
    const notReady = await createPhotographerAccount('QA상세준비중');
    const [photo] = await createPhotos(notReady.photographerId, 1);
    const res = await detail(photo!);
    expect(res.status).toBe(200);
    expect(res.body.photographer.id).toBe(notReady.photographerId);
  });

  it('DETAIL-BE-R1 평점·리뷰 수가 작가 프로필과 같고, 좋아요 수·하트가 피드 카드와 같다 (L2-08, L2-09)', async () => {
    const body = (await detail(p1Photos[1]!, u1.token)).body;
    const profile = (await api().get(`/photographers/${p1.photographerId}`))
      .body;
    expect(body.photographer).toMatchObject({
      ratingAvg: profile.ratingAvg,
      reviewCount: profile.reviewCount,
    });

    const feed = (
      await api().get('/photos?sort=latest&limit=50').set(bearer(u1.token))
    ).body.items;
    const card = feed.find(
      ({ photoId }: { photoId: string }) => photoId === p1Photos[1],
    );
    expect(card).toMatchObject({
      liked: body.liked,
      likeCount: body.likeCount,
    });
  });

  it('DETAIL-BE-R2 상세에서 좋아요하면 피드 카드에도 같은 하트·숫자 (L2-11·12·14)', async () => {
    const user = await createUserAccount('QA상세좋아요');
    const photoId = p1Photos[5]!;
    const res = await api()
      .put(`/photos/${photoId}/like`)
      .set(bearer(user.token));
    const body = (await detail(photoId, user.token)).body;
    expect(body).toMatchObject({ liked: true, likeCount: res.body.likeCount });
    const card = (
      await api().get('/photos?sort=latest&limit=50').set(bearer(user.token))
    ).body.items.find(({ photoId: id }: { photoId: string }) => id === photoId);
    expect(card).toMatchObject({ liked: true, likeCount: res.body.likeCount });
  });
});

// ---------------------------------------------------------------------------
describe('DETAIL BE · 작가의 다른 사진 GET /photographers/{id}/photos', () => {
  it('DETAIL-BE-10 excludePhotoId로 넘긴 사진은 응답에 없다', async () => {
    const exclude = p1Photos[11]!;
    const res = await others(
      p1.photographerId,
      `?excludePhotoId=${exclude}&limit=50`,
    );
    const ids = res.body.items.map(
      ({ photoId }: { photoId: string }) => photoId,
    );
    expect(ids).not.toContain(exclude);
    expect(res.body.totalCount).toBe(ids.length);
  });

  it('DETAIL-BE-11 최신순이고, 같은 시각이면 id 역순', async () => {
    const photographer = await readyPhotographer('QA상세정렬');
    const ids = await createPhotos(photographer.photographerId, 3);
    const sameTime = new Date(Date.now() - 10_000);
    const [a, b] = await Promise.all(
      [0, 1].map(() =>
        prisma.photos.create({
          data: {
            photographer_id: photographer.photographerId,
            storage_location: `qa/same-${randomUUID()}.webp`,
            width: 1,
            height: 1,
            created_at: sameTime,
          },
        }),
      ),
    );
    const sameDesc = [a!.id, b!.id].sort().reverse();
    const res = (await others(photographer.photographerId, '?limit=50')).body;
    expect(
      res.items.map(({ photoId }: { photoId: string }) => photoId),
    ).toEqual([...sameDesc, ...[...ids].reverse()]);
  });

  it('DETAIL-BE-12 limit=8이면 8장과 nextCursor, 마지막 페이지에는 nextCursor 없음 (L1-25)', async () => {
    const exclude = p1Photos[11]!;
    const first = (
      await others(p1.photographerId, `?excludePhotoId=${exclude}&limit=8`)
    ).body;
    expect(first.items).toHaveLength(8);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = (
      await others(
        p1.photographerId,
        `?excludePhotoId=${exclude}&limit=8&cursor=${first.nextCursor}`,
      )
    ).body;
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map(
      ({ photoId }: { photoId: string }) => photoId,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(first.totalCount);
  });

  it('DETAIL-BE-13 대표 사진은 isRepresentative: true', async () => {
    const photographer = await readyPhotographer('QA상세대표');
    const ids = await createPhotos(photographer.photographerId, 3);
    await prisma.representative_photos.create({
      data: { photographer_id: photographer.photographerId, photo_id: ids[1]! },
    });
    const items = (await others(photographer.photographerId)).body.items;
    for (const row of items) {
      expect(row.isRepresentative).toBe(row.photoId === ids[1]);
    }
  });

  it('DETAIL-BE-14 excludePhotoId가 UUID가 아니면 400 VALIDATION_FAILED', async () => {
    const res = await others(p1.photographerId, '?excludePhotoId=abc');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('DETAIL-BE-15 다른 excludePhotoId로 받은 커서를 붙이면 400 INVALID_CURSOR', async () => {
    const cursor = (
      await others(p1.photographerId, `?excludePhotoId=${p1Photos[0]}&limit=8`)
    ).body.nextCursor;
    const res = await others(
      p1.photographerId,
      `?excludePhotoId=${p1Photos[1]}&limit=8&cursor=${cursor}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURSOR');
  });

  it('DETAIL-BE-16 없는 작가 id면 404 PHOTOGRAPHER_NOT_FOUND', async () => {
    const res = await others(randomUUID());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PHOTOGRAPHER_NOT_FOUND');
  });

  it('DETAIL-BE-R3 사진이 1장뿐인 작가는 그 사진을 빼면 빈 목록 (L1-26)', async () => {
    const photographer = await readyPhotographer('QA상세한장');
    const [only] = await createPhotos(photographer.photographerId, 1);
    expect(
      (await others(photographer.photographerId, `?excludePhotoId=${only}`))
        .body,
    ).toMatchObject({
      items: [],
      totalCount: 0,
      nextCursor: null,
    });
  });
});

// ---------------------------------------------------------------------------
describe('DETAIL AC · 접근 제어', () => {
  let notReady: Photographer;
  beforeAll(async () => {
    notReady = await createPhotographerAccount('QA상세AC준비중');
    await createPhotos(notReady.photographerId, 2);
  });

  it('DETAIL-AC-02 위조 토큰으로 사진 상세면 401 UNAUTHORIZED', async () => {
    const res = await detail(p1Photos[0]!, 'forged.token.value');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('DETAIL-AC-03 준비 중 작가의 다른 사진은 비로그인·일반·다른 작가 모두 403 PHOTOGRAPHER_NOT_READY (L2-21)', async () => {
    for (const token of [undefined, u1.token, p7.token]) {
      const res = await others(notReady.photographerId, '', token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PHOTOGRAPHER_NOT_READY');
    }
  });

  it('DETAIL-AC-04 준비 중 작가 본인 토큰이면 200 (L2-24)', async () => {
    const res = await others(notReady.photographerId, '', notReady.token);
    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
  });

  it.each([0, 51])('DETAIL-AC-05 limit=%i이면 400', async (limit) => {
    const res = await others(p1.photographerId, `?limit=${limit}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('DETAIL-AC-06 UUID가 아닌 작가 id면 400 VALIDATION_FAILED', async () => {
    const res = await others('not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});
