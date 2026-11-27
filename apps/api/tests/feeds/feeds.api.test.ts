/**
 * FEED QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - 기본순(seed) 줄(BE-01~03)은 추천순으로 바뀐 기준(feat/feed-algorithm)으로 판정한다
 * - "기록한다" 줄은 통과·실패 대신 본 값을 표로 출력한다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { refreshValueScores } from '../../src/modules/recommendations/value-score.service.js';
import {
  api,
  bearer,
  createRecorder,
  expiredToken,
  tokenFor,
} from '../helpers.js';

type FeedPage = {
  items: { photoId: string; likeCount: number; liked: boolean }[];
  totalCount: number;
  nextCursor: string | null;
  seed?: unknown;
};

const recorder = createRecorder('FEED BE');

const decodeCursor = (cursor: string) =>
  JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
    o: number;
    k: string;
    t?: number;
  };

async function getPage(query: string, token?: string) {
  const req = api().get(`/photos${query}`);
  const res = await (token ? req.set(bearer(token)) : req);
  return res;
}

/** nextCursor를 따라 끝까지 받는다 */
async function fetchAll(query = '', token?: string) {
  const sep = query ? '&' : '';
  const pages: FeedPage[] = [];
  let cursor: string | null = null;
  do {
    const res = await getPage(
      `?${query}${cursor ? `${sep}cursor=${cursor}` : ''}`,
      token,
    );
    expect(res.status).toBe(200);
    const page = res.body as FeedPage;
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor);
  const items = pages.flatMap((page) => page.items);
  return {
    pages,
    items,
    ids: items.map(({ photoId }) => photoId),
    totalCount: pages[0]?.totalCount ?? 0,
  };
}

/** 첫 페이지를 받은 뒤 mutate하고, 이어지는 페이지에서 빠지거나 겹친 사진을 센다 */
async function scrollWithChange(query: string, mutate: () => Promise<void>) {
  const before = await fetchAll(query);
  const first = (await getPage(`?${query}&limit=20`)).body as FeedPage;
  await mutate();
  const rest: string[] = [];
  let cursor = first.nextCursor;
  while (cursor) {
    const page = (await getPage(`?${query}&limit=20&cursor=${cursor}`))
      .body as FeedPage;
    rest.push(...page.items.map(({ photoId }) => photoId));
    cursor = page.nextCursor;
  }
  const seen = [...first.items.map(({ photoId }) => photoId), ...rest];
  const duplicated = seen.filter((id, i) => seen.indexOf(id) !== i);
  const missing = before.ids.filter((id) => !seen.includes(id));
  return { duplicated, missing };
}

// 테스트 데이터 (테스트 DB에만 만든다)
let userToken = '';
let userAccountId = '';
let userId = '';
let photographerToken = '';
let notReadyPhotoId = '';
let keywordPhotoId = '';
let descriptionPhotoId = '';
let nicknamePhotographerId = '';
let sameTimePhotoIds: string[] = [];

beforeAll(async () => {
  await refreshValueScores(new Date());

  // 일반: 좋아요가 가장 많은 사용자
  const [liker] = await prisma.photo_likes.groupBy({
    by: ['user_id'],
    _count: { _all: true },
    orderBy: { _count: { user_id: 'desc' } },
    take: 1,
  });
  const user = await prisma.users.findUniqueOrThrow({
    where: { id: liker!.user_id },
    select: { id: true, auth_account_id: true },
  });
  userId = user.id;
  userAccountId = user.auth_account_id;
  userToken = await tokenFor(user.auth_account_id);

  // 작가: 피드에 노출되는 작가
  const photographers = await prisma.photographers.findMany({
    where: { photo: { some: {} } },
    select: { id: true, auth_account_id: true },
    orderBy: { id: 'asc' },
  });
  photographerToken = await tokenFor(photographers[0]!.auth_account_id);

  // TD-4 준비 중 작가 (프로필 이미지·지역 없음) + 사진
  const account = await prisma.auth_accounts.create({
    data: { account_type: 'PHOTOGRAPHER', nickname: 'QA준비중작가' },
  });
  const notReady = await prisma.photographers.create({
    data: { auth_account_id: account.id },
  });
  notReadyPhotoId = (
    await prisma.photos.create({
      data: {
        photographer_id: notReady.id,
        storage_location: 'qa/not-ready.webp',
        width: 100,
        height: 100,
      },
    })
  ).id;

  const listedPhotos = await prisma.photos.findMany({
    where: { photographer_id: { in: photographers.map(({ id }) => id) } },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 4,
  });
  // TD-3 대문자 키워드
  keywordPhotoId = listedPhotos[0]!.id;
  await prisma.photo_keywords.create({
    data: { photo_id: keywordPhotoId, keyword: 'QAFilm' },
  });
  // TD-7 영문 설명
  descriptionPhotoId = listedPhotos[1]!.id;
  await prisma.photos.update({
    where: { id: descriptionPhotoId },
    data: { description: 'QA Golden Hour' },
  });
  // TD-7 영문 활동명
  nicknamePhotographerId = photographers[1]!.id;
  await prisma.auth_accounts.update({
    where: { id: photographers[1]!.auth_account_id },
    data: { nickname: 'QA Ongyeol' },
  });
  // BE-04 같은 시각에 올라간 사진 2장
  sameTimePhotoIds = [listedPhotos[2]!.id, listedPhotos[3]!.id];
  await prisma.photos.updateMany({
    where: { id: { in: sameTimePhotoIds } },
    data: { created_at: new Date(Date.now() - 60_000) },
  });
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
describe('FEED BE · 정렬 (추천순 기준)', () => {
  it('FEED-BE-01 sort 없이 요청하면 추천순으로 오고, 응답에 seed가 없다', async () => {
    const res = await getPage('');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('seed');
    expect(decodeCursor(res.body.nextCursor).k).toContain('"recommended"');
  });

  it('FEED-BE-02 같은 조건으로 여러 번 요청하면 순서가 같다', async () => {
    const a = await fetchAll('');
    const b = await fetchAll('');
    expect(b.ids).toEqual(a.ids);
  });

  it('FEED-BE-03 seed를 보내도 무시하고 같은 순서로 온다 (seed 제거)', async () => {
    const a = (await getPage('?seed=s_aaaa')).body as FeedPage;
    const b = (await getPage('?seed=s_bbbb')).body as FeedPage;
    expect(b.items.map(({ photoId }) => photoId)).toEqual(
      a.items.map(({ photoId }) => photoId),
    );
  });

  it('FEED-BE-03b 이전 FE의 sort=random은 추천순으로 온다 (임시 호환)', async () => {
    const random = (await getPage('?sort=random&seed=s_x')).body as FeedPage;
    const recommended = (await getPage('')).body as FeedPage;
    expect(random.items.map(({ photoId }) => photoId)).toEqual(
      recommended.items.map(({ photoId }) => photoId),
    );
  });

  it('FEED-BE-04 최신순에서 같은 시각에 올라간 사진은 id 역순으로 온다', async () => {
    const { ids } = await fetchAll('sort=latest');
    const [higher, lower] = [...sameTimePhotoIds].sort().reverse();
    expect(ids.indexOf(higher!)).toBeLessThan(ids.indexOf(lower!));
    expect(ids.indexOf(lower!) - ids.indexOf(higher!)).toBe(1);
  });

  it('FEED-BE-05 인기순은 좋아요 많은 순, 같으면 최신순이다', async () => {
    const { items, ids } = await fetchAll('sort=popular');
    const createdAt = new Map(
      (
        await prisma.photos.findMany({
          where: { id: { in: ids } },
          select: { id: true, created_at: true },
        })
      ).map((photo) => [photo.id, photo.created_at.getTime()]),
    );
    items.slice(1).forEach((item, i) => {
      const prev = items[i]!;
      expect(prev.likeCount).toBeGreaterThanOrEqual(item.likeCount);
      if (prev.likeCount === item.likeCount) {
        expect(createdAt.get(prev.photoId)!).toBeGreaterThanOrEqual(
          createdAt.get(item.photoId)!,
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
describe('FEED BE · 페이지', () => {
  it('FEED-BE-06 limit 없이 20장, limit=50이면 50장', async () => {
    expect((await getPage('')).body.items).toHaveLength(20);
    expect((await getPage('?limit=50')).body.items).toHaveLength(50);
  });

  it.each(['', 'sort=latest', 'sort=popular'])(
    'FEED-BE-07 끝까지 받으면 photoId가 겹치지 않고 합계가 totalCount와 같다 (%s)',
    async (query) => {
      const { ids, totalCount } = await fetchAll(query);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(totalCount);
    },
  );

  it('FEED-BE-08 마지막 페이지에는 nextCursor가 없다', async () => {
    const { pages } = await fetchAll('limit=50');
    expect(pages.at(-1)!.nextCursor).toBeNull();
    pages
      .slice(0, -1)
      .forEach((page) => expect(page.nextCursor).not.toBeNull());
  });

  it('FEED-BE-R1 추천순 커서의 기준 시각은 모든 페이지에서 같다', async () => {
    const { pages } = await fetchAll('');
    const times = pages.flatMap((page) =>
      page.nextCursor ? [decodeCursor(page.nextCursor).t] : [],
    );
    expect(times.length).toBeGreaterThan(0);
    expect(new Set(times).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('FEED BE · 필터 · 검색', () => {
  it('FEED-BE-10 styles=A,B와 styles=A&styles=B는 같은 결과', async () => {
    const a = await fetchAll('sort=latest&styles=CINEMATIC,DREAMY');
    const b = await fetchAll('sort=latest&styles=CINEMATIC&styles=DREAMY');
    expect(a.ids.length).toBeGreaterThan(0);
    expect(b.ids).toEqual(a.ids);
  });

  it('FEED-BE-11 styles=A,A는 styles=A와 같은 결과', async () => {
    const a = await fetchAll('sort=latest&styles=CINEMATIC,CINEMATIC');
    const b = await fetchAll('sort=latest&styles=CINEMATIC');
    expect(a.ids).toEqual(b.ids);
  });

  it('FEED-BE-12 keyword 앞뒤 공백은 빼고 검색된다', async () => {
    const a = await fetchAll(
      `sort=latest&keyword=${encodeURIComponent('  QA Golden  ')}`,
    );
    const b = await fetchAll(
      `sort=latest&keyword=${encodeURIComponent('QA Golden')}`,
    );
    expect(b.ids).toContain(descriptionPhotoId);
    expect(a.ids).toEqual(b.ids);
  });

  it('FEED-BE-13a 활동명은 대소문자를 구분하지 않는다', async () => {
    const { ids } = await fetchAll('sort=latest&keyword=qa%20ongyeol');
    const photos = await prisma.photos.findMany({
      where: { photographer_id: nicknamePhotographerId },
      select: { id: true },
    });
    expect(ids.length).toBeGreaterThan(0);
    photos.forEach(({ id }) => expect(ids).toContain(id));
  });

  it('FEED-BE-13b 설명은 대소문자를 구분하지 않는다', async () => {
    const { ids } = await fetchAll('sort=latest&keyword=qa%20golden%20hour');
    expect(ids).toContain(descriptionPhotoId);
  });

  it('FEED-BE-13c 키워드는 대소문자를 구분하지 않는다 (11-26 결정)', async () => {
    const { ids } = await fetchAll('sort=latest&keyword=qafilm');
    expect(ids).toContain(keywordPhotoId);
  });

  it('FEED-BE-14 keyword=%와 keyword=_가 전체 일치로 해석되는지 기록', async () => {
    const all = (await getPage('?sort=latest')).body.totalCount;
    const percent = (await getPage('?sort=latest&keyword=%25')).body.totalCount;
    const underscore = (await getPage('?sort=latest&keyword=_')).body
      .totalCount;
    recorder.record('FEED-BE-14', { 전체: all, '%': percent, _: underscore });
  });
});

// ---------------------------------------------------------------------------
describe('FEED BE · 로그인 상태', () => {
  it('FEED-BE-15 비로그인이면 모든 사진이 liked: false', async () => {
    const { items } = await fetchAll('limit=50');
    expect(items.every(({ liked }) => !liked)).toBe(true);
  });

  it('FEED-BE-16 일반 토큰이면 좋아요한 사진만 liked: true', async () => {
    const { items } = await fetchAll('limit=50', userToken);
    const likedIds = new Set(
      (
        await prisma.photo_likes.findMany({
          where: { user_id: userId },
          select: { photo_id: true },
        })
      ).map(({ photo_id }) => photo_id),
    );
    expect(likedIds.size).toBeGreaterThan(0);
    items.forEach(({ photoId, liked }) =>
      expect(liked).toBe(likedIds.has(photoId)),
    );
  });

  it('FEED-BE-17 작가 토큰이면 모든 사진이 liked: false', async () => {
    const { items } = await fetchAll('limit=50', photographerToken);
    expect(items.every(({ liked }) => !liked)).toBe(true);
  });

  it('FEED-BE-18 만료되거나 위조된 토큰이면 401 UNAUTHORIZED', async () => {
    const expired = await getPage('', expiredToken(userAccountId));
    const forged = await getPage('', 'not-a-jwt');
    for (const res of [expired, forged]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('FEED-BE-R2 추천순 스크롤 도중 로그인하면 400 INVALID_CURSOR', async () => {
    const guestCursor = (await getPage('')).body.nextCursor as string;
    const res = await getPage(`?cursor=${guestCursor}`, userToken);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURSOR');
  });
});

// ---------------------------------------------------------------------------
describe('FEED BE · 좋아요 API', () => {
  async function notLikedPhoto() {
    const photo = await prisma.photos.findFirstOrThrow({
      where: {
        photoLike: { none: { user_id: userId } },
        id: { not: notReadyPhotoId },
      },
      select: { id: true },
    });
    return photo.id;
  }
  const likeRows = (photoId: string) =>
    prisma.photo_likes.count({ where: { user_id: userId, photo_id: photoId } });

  it('FEED-BE-19 PUT like를 두 번 보내도 1건만 생기고 숫자는 1만 오른다', async () => {
    const photoId = await notLikedPhoto();
    const before = await prisma.photo_likes.count({
      where: { photo_id: photoId },
    });
    const first = await api()
      .put(`/photos/${photoId}/like`)
      .set(bearer(userToken));
    const second = await api()
      .put(`/photos/${photoId}/like`)
      .set(bearer(userToken));
    expect(first.status).toBe(200);
    expect(second.body).toMatchObject({ liked: true, likeCount: before + 1 });
    expect(await likeRows(photoId)).toBe(1);
    await api().delete(`/photos/${photoId}/like`).set(bearer(userToken));
  });

  it('FEED-BE-20 좋아요하지 않은 사진에 DELETE like면 200 liked: false, 숫자 그대로', async () => {
    const photoId = await notLikedPhoto();
    const before = await prisma.photo_likes.count({
      where: { photo_id: photoId },
    });
    const res = await api()
      .delete(`/photos/${photoId}/like`)
      .set(bearer(userToken));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ liked: false, likeCount: before });
  });

  it('FEED-BE-21 PUT like를 동시에 두 번 보내도 1건만 생긴다', async () => {
    const photoId = await notLikedPhoto();
    const results = await Promise.all([
      api().put(`/photos/${photoId}/like`).set(bearer(userToken)),
      api().put(`/photos/${photoId}/like`).set(bearer(userToken)),
    ]);
    results.forEach((res) => expect(res.status).toBe(200));
    expect(await likeRows(photoId)).toBe(1);
    await api().delete(`/photos/${photoId}/like`).set(bearer(userToken));
  });

  it('FEED-BE-22 없는 UUID면 404 PHOTO_NOT_FOUND', async () => {
    const res = await api()
      .put(`/photos/${randomUUID()}/like`)
      .set(bearer(userToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PHOTO_NOT_FOUND');
  });

  it('FEED-BE-25 UUID 형식이 아니면 400 VALIDATION_FAILED', async () => {
    const res = await api()
      .put('/photos/not-a-uuid/like')
      .set(bearer(userToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('FEED-BE-23 준비 중 작가의 사진에 좋아요한 응답을 기록', async () => {
    const res = await api()
      .put(`/photos/${notReadyPhotoId}/like`)
      .set(bearer(userToken));
    recorder.record('FEED-BE-23', { status: res.status, body: res.body });
    await api()
      .delete(`/photos/${notReadyPhotoId}/like`)
      .set(bearer(userToken));
  });
});

// ---------------------------------------------------------------------------
describe('FEED AC · 접근 제어', () => {
  it('FEED-AC-01 비로그인 GET /photos는 200', async () => {
    expect((await getPage('')).status).toBe(200);
  });

  it.each([
    ['FEED-AC-02', '?category=XYZ', 'INVALID_CATEGORY'],
    ['FEED-AC-03', '?styles=XYZ', 'INVALID_STYLE'],
    ['FEED-AC-04', '?regions=XYZ', 'INVALID_REGION'],
    ['FEED-AC-05', `?keyword=${'가'.repeat(51)}`, 'VALIDATION_FAILED'],
    ['FEED-AC-06', '?limit=51', 'VALIDATION_FAILED'],
    ['FEED-AC-06', '?limit=0', 'VALIDATION_FAILED'],
    ['FEED-AC-07', '?cursor=abc', 'INVALID_CURSOR'],
  ])('%s %s는 400 %s', async (_id, query, code) => {
    const res = await getPage(encodeURI(query));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
  });

  it('FEED-AC-08 최신순 커서로 인기순을 요청하면 400 INVALID_CURSOR', async () => {
    const cursor = (await getPage('?sort=latest')).body.nextCursor as string;
    const res = await getPage(`?sort=popular&cursor=${cursor}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURSOR');
  });

  it.each(['', 'sort=latest', 'sort=popular'])(
    'FEED-AC-09 준비 중 작가의 사진은 나오지 않는다 (%s)',
    async (query) => {
      const { ids } = await fetchAll(query);
      expect(ids).not.toContain(notReadyPhotoId);
    },
  );

  it('FEED-AC-10 비로그인 PUT·DELETE like는 401 UNAUTHORIZED', async () => {
    const photoId = keywordPhotoId;
    for (const res of [
      await api().put(`/photos/${photoId}/like`),
      await api().delete(`/photos/${photoId}/like`),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('FEED-AC-11 작가 토큰 PUT·DELETE like는 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    const photoId = keywordPhotoId;
    for (const res of [
      await api().put(`/photos/${photoId}/like`).set(bearer(photographerToken)),
      await api()
        .delete(`/photos/${photoId}/like`)
        .set(bearer(photographerToken)),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
    }
  });

  it('FEED-AC-12 일반 토큰 PUT·DELETE like는 200', async () => {
    const photoId = keywordPhotoId;
    const put = await api()
      .put(`/photos/${photoId}/like`)
      .set(bearer(userToken));
    const del = await api()
      .delete(`/photos/${photoId}/like`)
      .set(bearer(userToken));
    expect(put.status).toBe(200);
    expect(del.status).toBe(200);
  });

  it('FEED-AC-13 위조 토큰으로 GET /photos는 401 UNAUTHORIZED', async () => {
    const res = await getPage('', 'forged.token.value');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// 데이터를 바꾸는 테스트라 마지막에 둔다
describe('FEED BE · 스크롤 도중 변경 (기록)', () => {
  it('FEED-BE-24 조건 없이 첫 페이지 응답 시간을 기록', async () => {
    await getPage('');
    const start = performance.now();
    await getPage('');
    recorder.record(
      'FEED-BE-24',
      `${(performance.now() - start).toFixed(1)}ms`,
    );
  });

  it('FEED-BE-R3 추천순 첫 페이지 뒤 사진이 올라와도 이어지는 페이지에 중복·누락이 없다', async () => {
    const photographer = await prisma.photographers.findFirstOrThrow({
      where: { id: nicknamePhotographerId },
      select: { id: true },
    });
    const result = await scrollWithChange('sort=recommended', async () => {
      await prisma.photos.create({
        data: {
          photographer_id: photographer.id,
          storage_location: 'qa/new-recommended.webp',
          width: 100,
          height: 100,
        },
      });
    });
    expect(result).toEqual({ duplicated: [], missing: [] });
  });

  it('FEED-BE-09 최신순 첫 페이지 뒤 사진을 추가하고 중복·누락을 기록', async () => {
    const result = await scrollWithChange('sort=latest', async () => {
      await prisma.photos.create({
        data: {
          photographer_id: nicknamePhotographerId,
          storage_location: 'qa/new-latest.webp',
          width: 100,
          height: 100,
        },
      });
    });
    recorder.record('FEED-BE-09', {
      중복: result.duplicated.length,
      누락: result.missing.length,
    });
  });

  it('FEED-BE-26 인기순 첫 페이지 뒤 좋아요로 순위를 바꾸고 중복·누락을 기록', async () => {
    const { items } = await fetchAll('sort=popular');
    // 2페이지 끝쪽 사진을 좋아요해 1페이지 쪽으로 끌어올린다
    const target = items[35]!.photoId;
    const result = await scrollWithChange('sort=popular', async () => {
      await prisma.photo_likes.createMany({
        data: (await prisma.users.findMany({ select: { id: true } })).map(
          ({ id }) => ({
            user_id: id,
            photo_id: target,
          }),
        ),
        skipDuplicates: true,
      });
    });
    recorder.record('FEED-BE-26', {
      중복: result.duplicated.length,
      누락: result.missing.length,
    });
  });

  it('FEED-BE-27 첫 페이지 뒤 사진을 삭제하고 빠진 사진을 기록 (추천순)', async () => {
    const first = (await getPage('?limit=20')).body as FeedPage;
    const deleted = first.items[0]!.photoId;
    const result = await scrollWithChange('', async () => {
      await prisma.photos.delete({ where: { id: deleted } });
    });
    const missingExceptDeleted = result.missing.filter((id) => id !== deleted);
    recorder.record('FEED-BE-27', {
      중복: result.duplicated.length,
      '누락 (삭제한 사진 제외)': missingExceptDeleted.length,
    });
  });
});
