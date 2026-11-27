/**
 * MYPICK QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - 좋아요·저장 순서를 정확히 보려고 테스트 전용 일반 계정을 새로 만들고, 좋아요·저장 시각을 직접 정한다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { toImageUrl } from '../../src/utils/asset-url.js';
import { api, bearer, createRecorder } from '../helpers.js';
import { createPhotographerAccount, createUserAccount } from '../fixtures.js';

type User = Awaited<ReturnType<typeof createUserAccount>>;
type Photographer = Awaited<ReturnType<typeof createPhotographerAccount>>;

const recorder = createRecorder('MYPICK BE · AC');
let p1: Photographer;
let notReady: Photographer;

beforeAll(async () => {
  p1 = await createPhotographerAccount('QA픽P1');
  await prisma.photographers.update({
    where: { id: p1.photographerId },
    data: { profile_image_url: 'qa/p1.webp', career: 3 },
  });
  // 준비 중 작가 (프로필 이미지·경력 없음, TD-5)
  notReady = await createPhotographerAccount('QA픽준비중');
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

const createPhoto = (photographerId: string, name: string) =>
  prisma.photos.create({
    data: {
      photographer_id: photographerId,
      storage_location: `qa/${name}.webp`,
      width: 1,
      height: 1,
    },
  });

/** count장을 좋아요한 새 일반 계정. 좋아요 시각은 1분 간격 (마지막 사진이 가장 최근) */
async function userWithLikes(count: number) {
  const user = await createUserAccount('QA픽유저');
  const photos = [];
  for (let i = 0; i < count; i++)
    photos.push(await createPhoto(p1.photographerId, `like-${randomUUID()}`));
  const base = Date.now() - count * 60_000;
  await prisma.photo_likes.createMany({
    data: photos.map((photo, i) => ({
      user_id: user.userId,
      photo_id: photo.id,
      created_at: new Date(base + i * 60_000),
    })),
  });
  return { user, photoIds: photos.map(({ id }) => id) };
}

/** count명을 저장한 새 일반 계정. 저장 시각은 1분 간격 (마지막 작가가 가장 최근) */
async function userWithSaves(count: number) {
  const user = await createUserAccount('QA픽저장');
  const photographers = [];
  for (let i = 0; i < count; i++)
    photographers.push(await createPhotographerAccount('QA픽작가'));
  const base = Date.now() - count * 60_000;
  await prisma.photographer_saves.createMany({
    data: photographers.map(({ photographerId }, i) => ({
      user_id: user.userId,
      photographer_id: photographerId,
      created_at: new Date(base + i * 60_000),
    })),
  });
  return {
    user,
    photographerIds: photographers.map(({ photographerId }) => photographerId),
  };
}

const liked = (token: string | null, query = '') => {
  const req = api().get(`/me/liked-photos${query}`);
  return token ? req.set(bearer(token)) : req;
};
const saved = (token: string | null, query = '') => {
  const req = api().get(`/me/saved-photographers${query}`);
  return token ? req.set(bearer(token)) : req;
};
const save = (
  token: string | null,
  photographerId: string,
  method: 'put' | 'delete' = 'put',
) => {
  const req = api()[method](`/photographers/${photographerId}/save`);
  return token ? req.set(bearer(token)) : req;
};

/** nextCursor를 따라 끝까지 받는다 */
async function fetchAll(
  get: (query: string) => ReturnType<typeof liked>,
  limit: number,
  idKey: 'photoId' | 'photographerId',
) {
  const ids: string[] = [];
  let cursor: string | null = null;
  let totalCount = 0;
  do {
    const body: {
      items: Record<string, string>[];
      totalCount: number;
      nextCursor: string | null;
    } = (await get(`?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`)).body;
    totalCount = body.totalCount;
    ids.push(...body.items.map((item) => item[idKey] ?? ''));
    cursor = body.nextCursor;
  } while (cursor);
  return { ids, totalCount };
}

// ---------------------------------------------------------------------------
describe('MYPICK BE · 좋아요한 사진 GET /me/liked-photos', () => {
  it('MYPICK-BE-01 좋아요한 시각 최신순, limit 없이 20장 (L2-04)', async () => {
    const { user, photoIds } = await userWithLikes(25);
    const page = (await liked(user.token)).body;
    expect(page.items).toHaveLength(20);
    expect(page.totalCount).toBe(25);
    expect(
      page.items.map(({ photoId }: { photoId: string }) => photoId),
    ).toEqual([...photoIds].reverse().slice(0, 20));
  });

  it('MYPICK-BE-02 nextCursor로 끝까지 받으면 photoId가 겹치지 않고 합계가 totalCount와 같다', async () => {
    const { user } = await userWithLikes(25);
    const { ids, totalCount } = await fetchAll(
      (q) => liked(user.token, q),
      20,
      'photoId',
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(totalCount);
  });

  it('MYPICK-BE-03 첫 페이지 뒤 1페이지 사진의 좋아요를 취소하고, 다음 커서 응답에서 빠진 photoId를 기록', async () => {
    const { user, photoIds } = await userWithLikes(25);
    const first = (await liked(user.token)).body;
    const removed = first.items[0].photoId as string;
    await api().delete(`/photos/${removed}/like`).set(bearer(user.token));
    const second = (await liked(user.token, `?cursor=${first.nextCursor}`))
      .body;
    const seen = new Set(
      [...first.items, ...second.items].map(
        ({ photoId }: { photoId: string }) => photoId,
      ),
    );
    const missing = photoIds.filter((id) => id !== removed && !seen.has(id));
    recorder.record('MYPICK-BE-03', {
      '빠진 사진 수': missing.length,
      '다음 페이지 장수': second.items.length,
    });
  });

  it('MYPICK-BE-04 준비 중 작가의 사진도 응답에 있다 (L2-12)', async () => {
    const user = await createUserAccount('QA픽준비중사진');
    const photo = await createPhoto(
      notReady.photographerId,
      `not-ready-${randomUUID()}`,
    );
    await prisma.photo_likes.create({
      data: { user_id: user.userId, photo_id: photo.id },
    });
    const ids = (await liked(user.token)).body.items.map(
      ({ photoId }: { photoId: string }) => photoId,
    );
    expect(ids).toContain(photo.id);
  });

  it('MYPICK-BE-R1 좋아요를 취소하면 목록에서 빠지고 개수가 1 줄며, 상세에서도 좋아요가 풀리고 숫자가 1 준다 (L2-05, L2-06)', async () => {
    const { user, photoIds } = await userWithLikes(3);
    const target = photoIds[2]!;
    const before = (
      await api().get(`/photos/${target}`).set(bearer(user.token))
    ).body;
    expect(before.liked).toBe(true);

    expect(
      (await api().delete(`/photos/${target}/like`).set(bearer(user.token)))
        .status,
    ).toBe(200);
    const page = (await liked(user.token)).body;
    expect(page.totalCount).toBe(2);
    expect(
      page.items.map(({ photoId }: { photoId: string }) => photoId),
    ).not.toContain(target);
    const after = (await api().get(`/photos/${target}`).set(bearer(user.token)))
      .body;
    expect(after).toMatchObject({
      liked: false,
      likeCount: before.likeCount - 1,
    });
  });

  it('MYPICK-BE-R2 2페이지까지 본 뒤 1페이지 사진을 취소하고 다시 불러오면 남은 사진이 빠짐없이, 개수가 totalCount와 같다 (L2-07)', async () => {
    const { user, photoIds } = await userWithLikes(25);
    await liked(user.token);
    const removed = photoIds[24]!;
    await api().delete(`/photos/${removed}/like`).set(bearer(user.token));
    const { ids, totalCount } = await fetchAll(
      (q) => liked(user.token, q),
      20,
      'photoId',
    );
    expect(totalCount).toBe(24);
    expect(new Set(ids)).toEqual(
      new Set(photoIds.filter((id) => id !== removed)),
    );
  });

  it('MYPICK-BE-R3 작가가 사진을 삭제하면 목록에서 깨진 항목 없이 빠진다 (L2-11)', async () => {
    const { user, photoIds } = await userWithLikes(3);
    await prisma.photos.delete({ where: { id: photoIds[1]! } });
    const page = (await liked(user.token)).body;
    expect(page.totalCount).toBe(2);
    expect(
      page.items.map(({ photoId }: { photoId: string }) => photoId),
    ).toEqual([photoIds[2], photoIds[0]]);
  });
});

// ---------------------------------------------------------------------------
describe('MYPICK BE · 저장한 작가 GET /me/saved-photographers', () => {
  it('MYPICK-BE-05 저장한 시각 최신순, coverImageUrl은 대표 사진 주소이고 없으면 null (L2-13, TD-4)', async () => {
    const { user, photographerIds } = await userWithSaves(3);
    const cover = await createPhoto(
      photographerIds[2]!,
      `cover-${randomUUID()}`,
    );
    await prisma.representative_photos.create({
      data: { photographer_id: photographerIds[2]!, photo_id: cover.id },
    });

    const items = (await saved(user.token)).body.items;
    expect(
      items.map(
        ({ photographerId }: { photographerId: string }) => photographerId,
      ),
    ).toEqual([...photographerIds].reverse());
    expect(items[0].coverImageUrl).toBe(toImageUrl(cover.storage_location));
    expect(items[1].coverImageUrl).toBeNull();
    expect(items[1].profileImageUrl).toBeNull();
  });

  it('MYPICK-BE-06 첫 페이지 뒤 1페이지 작가의 저장을 취소하고, 다음 커서 응답에서 빠진 photographerId를 기록', async () => {
    const { user, photographerIds } = await userWithSaves(14);
    const first = (await saved(user.token, '?limit=12')).body;
    const removed = first.items[0].photographerId as string;
    await save(user.token, removed, 'delete');
    const second = (
      await saved(user.token, `?limit=12&cursor=${first.nextCursor}`)
    ).body;
    const seen = new Set(
      [...first.items, ...second.items].map(
        ({ photographerId }: { photographerId: string }) => photographerId,
      ),
    );
    const missing = photographerIds.filter(
      (id) => id !== removed && !seen.has(id),
    );
    recorder.record('MYPICK-BE-06', {
      '빠진 작가 수': missing.length,
      '다음 페이지 명수': second.items.length,
    });
  });

  it('MYPICK-BE-R4 저장을 취소하면 프로필의 saved가 풀리고 저장 수가 1 준다 (L2-14)', async () => {
    const { user, photographerIds } = await userWithSaves(1);
    const target = photographerIds[0]!;
    const before = (
      await api().get(`/photographers/${target}`).set(bearer(user.token))
    ).body;
    expect(before.saved).toBe(true);
    await save(user.token, target, 'delete');
    const after = (
      await api().get(`/photographers/${target}`).set(bearer(user.token))
    ).body;
    expect(after).toMatchObject({
      saved: false,
      savedCount: before.savedCount - 1,
    });
  });

  it('MYPICK-BE-R5 2페이지까지 본 뒤 1페이지 작가를 취소하고 다시 불러오면 남은 작가가 빠짐없이, 개수가 totalCount와 같다 (L2-15)', async () => {
    const { user, photographerIds } = await userWithSaves(14);
    const removed = photographerIds[13]!;
    await save(user.token, removed, 'delete');
    const { ids, totalCount } = await fetchAll(
      (q) => saved(user.token, q),
      12,
      'photographerId',
    );
    expect(totalCount).toBe(13);
    expect(new Set(ids)).toEqual(
      new Set(photographerIds.filter((id) => id !== removed)),
    );
  });

  it('MYPICK-BE-R6 대표 사진을 바꾸면 커버가 바뀌고, 삭제하면 null이 된다 (L2-17, L2-18)', async () => {
    const { user, photographerIds } = await userWithSaves(1);
    const id = photographerIds[0]!;
    const first = await createPhoto(id, `rep-a-${randomUUID()}`);
    const second = await createPhoto(id, `rep-b-${randomUUID()}`);
    await prisma.representative_photos.create({
      data: { photographer_id: id, photo_id: first.id },
    });
    const cover = async () =>
      (await saved(user.token)).body.items[0].coverImageUrl;
    expect(await cover()).toBe(toImageUrl(first.storage_location));

    await prisma.representative_photos.update({
      where: { photographer_id: id },
      data: { photo_id: second.id },
    });
    expect(await cover()).toBe(toImageUrl(second.storage_location));

    await prisma.photos.delete({ where: { id: second.id } });
    expect(await cover()).toBeNull();
  });

  it('MYPICK-BE-R7 준비 중 작가도 목록에 있다 (L2-19)', async () => {
    const user = await createUserAccount('QA픽준비중작가');
    await save(user.token, notReady.photographerId);
    const ids = (await saved(user.token)).body.items.map(
      ({ photographerId }: { photographerId: string }) => photographerId,
    );
    expect(ids).toContain(notReady.photographerId);
  });
});

// ---------------------------------------------------------------------------
describe('MYPICK BE · 저장 API PUT · DELETE /photographers/{id}/save', () => {
  it('MYPICK-BE-07 PUT save를 두 번 연속 보내도 저장은 1건', async () => {
    const user = await createUserAccount('QA픽두번');
    for (let i = 0; i < 2; i++) {
      const res = await save(user.token, p1.photographerId);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        photographerId: p1.photographerId,
        saved: true,
      });
    }
    expect(
      await prisma.photographer_saves.count({
        where: { user_id: user.userId },
      }),
    ).toBe(1);
  });

  it('MYPICK-BE-07b PUT save를 동시에 두 번 보내도 저장은 1건 (L2-16 서버 쪽)', async () => {
    const user = await createUserAccount('QA픽동시');
    const results = await Promise.all([
      save(user.token, p1.photographerId),
      save(user.token, p1.photographerId),
    ]);
    results.forEach(({ status }) => expect(status).toBe(200));
    expect(
      await prisma.photographer_saves.count({
        where: { user_id: user.userId },
      }),
    ).toBe(1);
  });

  it('MYPICK-BE-08 저장하지 않은 작가에 DELETE save도 오류 없이 처리된다', async () => {
    const user = await createUserAccount('QA픽미저장');
    const res = await save(user.token, p1.photographerId, 'delete');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      photographerId: p1.photographerId,
      saved: false,
    });
  });

  it('MYPICK-BE-09 없는 UUID 작가면 PUT·DELETE 모두 404 PHOTOGRAPHER_NOT_FOUND', async () => {
    const user = await createUserAccount('QA픽없는작가');
    for (const method of ['put', 'delete'] as const) {
      const res = await save(user.token, randomUUID(), method);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PHOTOGRAPHER_NOT_FOUND');
    }
  });

  it.each([0, 51])(
    'MYPICK-BE-10 limit=%i면 두 목록 모두 400',
    async (limit) => {
      const user = await createUserAccount('QA픽limit');
      for (const res of [
        await liked(user.token, `?limit=${limit}`),
        await saved(user.token, `?limit=${limit}`),
      ]) {
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_FAILED');
      }
    },
  );
});

// ---------------------------------------------------------------------------
describe('MYPICK AC · 접근 제어', () => {
  let user: User;
  beforeAll(async () => {
    user = (await userWithLikes(2)).user;
    await save(user.token, p1.photographerId);
  });

  it('MYPICK-AC-01 비로그인이면 두 목록 모두 401 UNAUTHORIZED', async () => {
    for (const res of [await liked(null), await saved(null)]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('MYPICK-AC-02 작가 토큰이면 두 목록 모두 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    for (const res of [await liked(p1.token), await saved(p1.token)]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
    }
  });

  it('MYPICK-AC-03 일반 토큰이면 200, 그 사용자의 목록만', async () => {
    const other = await createUserAccount('QA픽다른유저');
    const likedIds = (await liked(other.token)).body;
    const savedIds = (await saved(other.token)).body;
    expect(likedIds).toMatchObject({ items: [], totalCount: 0 });
    expect(savedIds).toMatchObject({ items: [], totalCount: 0 });

    const own = await prisma.photo_likes.findMany({
      where: { user_id: user.userId },
      select: { photo_id: true },
    });
    const mine = (await liked(user.token)).body.items.map(
      ({ photoId }: { photoId: string }) => photoId,
    );
    expect(new Set(mine)).toEqual(new Set(own.map(({ photo_id }) => photo_id)));
  });

  it('MYPICK-AC-04 비로그인 PUT·DELETE save는 401 UNAUTHORIZED', async () => {
    for (const method of ['put', 'delete'] as const) {
      const res = await save(null, p1.photographerId, method);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('MYPICK-AC-05 작가 토큰 PUT·DELETE save는 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    for (const method of ['put', 'delete'] as const) {
      const res = await save(notReady.token, p1.photographerId, method);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
    }
  });

  it('MYPICK-AC-06 UUID가 아닌 작가 id면 PUT·DELETE save 모두 400 VALIDATION_FAILED', async () => {
    for (const method of ['put', 'delete'] as const) {
      const res = await save(user.token, 'not-a-uuid', method);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
  });

  it('MYPICK-AC-07 임의의 cursor면 400 INVALID_CURSOR (다른 목록의 커서도)', async () => {
    const savedCursor = (await saved(user.token, '?limit=1')).body.nextCursor;
    for (const cursor of ['abc', savedCursor].filter(Boolean)) {
      const res = await liked(user.token, `?cursor=${cursor}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CURSOR');
    }
  });

  it('MYPICK-AC-08 위조 토큰이면 401 UNAUTHORIZED', async () => {
    const res = await liked('forged.token.value');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
