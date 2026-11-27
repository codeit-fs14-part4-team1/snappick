/**
 * MANAGE QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - BE-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 * - 사진은 DB로 직접 만든다 (저장소 파일 없음). 삭제할 때 저장소에서 지우는 것은 photos/ 경로만이라 영향이 없다
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder } from '../helpers.js';
import { createPhotographerAccount, createUserAccount } from '../fixtures.js';

type Photographer = Awaited<ReturnType<typeof createPhotographerAccount>>;

const recorder = createRecorder('MANAGE BE · AC');
let u1: Awaited<ReturnType<typeof createUserAccount>>;

beforeAll(async () => {
  u1 = await createUserAccount('QA관리U1');
});

afterAll(async () => {
  recorder.print();
  await prisma.$disconnect();
});

/** 사진 count장을 가진 작가. 첫 사진이 대표, 사진마다 키워드 2개 */
async function photographerWithPhotos(count: number) {
  const photographer = await createPhotographerAccount('QA관리작가');
  const photoIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const photo = await prisma.photos.create({
      data: {
        photographer_id: photographer.photographerId,
        storage_location: `qa/manage-${randomUUID()}.webp`,
        width: 100,
        height: 100,
        categories: ['PROFILE'],
        styles: ['NATURAL'],
        description: `QA 설명 ${i + 1}`,
        photoKeyword: { create: [{ keyword: '하나' }, { keyword: '둘' }] },
      },
    });
    photoIds.push(photo.id);
  }
  if (count > 0) {
    await prisma.representative_photos.create({
      data: {
        photographer_id: photographer.photographerId,
        photo_id: photoIds[0]!,
      },
    });
  }
  return { photographer, photoIds };
}

const batch = (token: string | null, body: unknown) => {
  const req = api()
    .patch('/me/photos/batch')
    .send(body as object);
  return token ? req.set(bearer(token)) : req;
};
const myPhoto = (token: string | null, photoId: string) => {
  const req = api().get(`/me/photos/${photoId}`);
  return token ? req.set(bearer(token)) : req;
};
const representativeOf = async (photographerId: string) =>
  (
    await prisma.representative_photos.findUnique({
      where: { photographer_id: photographerId },
    })
  )?.photo_id ?? null;
const photoCountOf = (photographerId: string) =>
  prisma.photos.count({ where: { photographer_id: photographerId } });

// ---------------------------------------------------------------------------
describe('MANAGE BE · 사진 일괄 수정 PATCH /me/photos/batch', () => {
  it('MANAGE-BE-01 정상 요청이면 200과 updatedCount·deletedCount·representativePhotoId·photoCount·빈 skipped·retry null·빈 failures', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(3);
    const res = await batch(photographer.token, {
      updates: [{ photoId: photoIds[1], description: 'QA 고친 설명' }],
      deletePhotoIds: [photoIds[2]],
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      updatedCount: 1,
      deletedCount: 1,
      representativePhotoId: photoIds[0],
      photoCount: 2,
      skippedPhotoIds: [],
      retry: null,
      failures: [],
    });
  });

  it.each([
    ['본문이 비었음', {}],
    ['바꿀 필드가 없는 updates 항목', { updates: [{ photoId: randomUUID() }] }],
  ])('MANAGE-BE-02 %s이면 400 VALIDATION_FAILED', async (_label, body) => {
    const { photographer } = await photographerWithPhotos(1);
    const res = await batch(photographer.token, body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('MANAGE-BE-03 updates나 deletePhotoIds가 21개면 400 VALIDATION_FAILED', async () => {
    const { photographer } = await photographerWithPhotos(1);
    const ids = Array.from({ length: 21 }, () => randomUUID());
    for (const body of [
      { updates: ids.map((photoId) => ({ photoId, description: 'QA' })) },
      { deletePhotoIds: ids },
    ]) {
      const res = await batch(photographer.token, body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
  });

  it('MANAGE-BE-04 같은 photoId를 두 번 보내면 400 DUPLICATE_VALUE', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(1);
    for (const body of [
      {
        updates: [
          { photoId: photoIds[0], description: 'a' },
          { photoId: photoIds[0], description: 'b' },
        ],
      },
      { deletePhotoIds: [photoIds[0], photoIds[0]] },
    ]) {
      const res = await batch(photographer.token, body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DUPLICATE_VALUE');
    }
  });

  it('MANAGE-BE-05 같은 사진을 수정과 삭제에 함께 넣으면 400 CONFLICTING_PHOTO_ACTION', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(1);
    const res = await batch(photographer.token, {
      updates: [{ photoId: photoIds[0], description: 'QA' }],
      deletePhotoIds: [photoIds[0]],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONFLICTING_PHOTO_ACTION');
  });

  it('MANAGE-BE-06 삭제할 사진을 대표로 지정하면 400 INVALID_REPRESENTATIVE', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(2);
    const res = await batch(photographer.token, {
      deletePhotoIds: [photoIds[1]],
      representativePhotoId: photoIds[1],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_REPRESENTATIVE');
  });

  it('MANAGE-BE-07 없는 사진을 수정하면 전체 404 PHOTO_NOT_FOUND, 같이 보낸 삭제·대표 변경도 반영되지 않는다', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(3);
    const res = await batch(photographer.token, {
      updates: [{ photoId: randomUUID(), description: 'QA' }],
      deletePhotoIds: [photoIds[2]],
      representativePhotoId: photoIds[1],
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PHOTO_NOT_FOUND');
    expect(await photoCountOf(photographer.photographerId)).toBe(3);
    expect(await representativeOf(photographer.photographerId)).toBe(
      photoIds[0],
    );
  });

  it('MANAGE-BE-08 이미 없는 사진을 삭제하면 200, 그 id가 skippedPhotoIds에 (L2-14)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(2);
    const gone = randomUUID();
    const res = await batch(photographer.token, {
      deletePhotoIds: [photoIds[1], gone],
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      deletedCount: 1,
      skippedPhotoIds: [gone],
      photoCount: 1,
    });
  });

  it.each(
    [
      ['카테고리 빈 배열', { categories: [] }, 'CATEGORY_REQUIRED'],
      ['없는 스타일', { styles: ['NEON'] }, 'INVALID_STYLE'],
      ['키워드 공백 포함', { keywords: ['노을 사진'] }, 'INVALID_KEYWORD'],
      ['설명 51자', { description: '가'.repeat(51) }, 'INVALID_DESCRIPTION'],
      // 테스트 이름에 오류 코드가 보이도록 [이름, 코드, 입력값] 순서로 바꾼다
    ].map(
      ([label, override, code]) =>
        [label, code, override] as [string, string, Record<string, unknown>],
    ),
  )(
    'MANAGE-BE-09 %s이면 400 %s, 아무것도 바뀌지 않는다',
    async (_label, code, override) => {
      const { photographer, photoIds } = await photographerWithPhotos(1);
      const res = await batch(photographer.token, {
        updates: [{ photoId: photoIds[0], ...override }],
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(code);
      expect(
        (await myPhoto(photographer.token, photoIds[0]!)).body,
      ).toMatchObject({
        categories: ['PROFILE'],
        description: 'QA 설명 1',
      });
    },
  );

  it('MANAGE-BE-10 description: null이면 설명이 지워진다 (L2-02)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(1);
    await batch(photographer.token, {
      updates: [{ photoId: photoIds[0], description: null }],
    });
    expect(
      (await api().get(`/photos/${photoIds[0]}`)).body.description,
    ).toBeNull();
  });

  it('MANAGE-BE-11 keywords를 보내면 기존 키워드가 보낸 값으로 통째로, 보낸 순서대로 바뀐다 (L2-03)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(1);
    await batch(photographer.token, {
      updates: [{ photoId: photoIds[0], keywords: ['셋', '하나'] }],
    });
    expect((await api().get(`/photos/${photoIds[0]}`)).body.keywords).toEqual([
      '셋',
      '하나',
    ]);
  });

  it('MANAGE-BE-12 representativePhotoId를 보내면 대표가 그 사진으로 바뀌고 응답에도 그 값 (L2-05)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(3);
    const res = await batch(photographer.token, {
      representativePhotoId: photoIds[2],
    });
    expect(res.body.representativePhotoId).toBe(photoIds[2]);
    expect(
      (await myPhoto(photographer.token, photoIds[2]!)).body.isRepresentative,
    ).toBe(true);
    expect(
      (await myPhoto(photographer.token, photoIds[0]!)).body.isRepresentative,
    ).toBe(false);
  });

  it('MANAGE-BE-13 대표 지정 없이 대표 사진만 삭제하면 representativePhotoId가 null', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(2);
    const res = await batch(photographer.token, {
      deletePhotoIds: [photoIds[0]],
    });
    expect(res.status).toBe(200);
    expect(res.body.representativePhotoId).toBeNull();
  });

  it('MANAGE-BE-16 없는 사진 id를 representativePhotoId로 보내면 400 INVALID_REPRESENTATIVE', async () => {
    const { photographer } = await photographerWithPhotos(1);
    const res = await batch(photographer.token, {
      representativePhotoId: randomUUID(),
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_REPRESENTATIVE');
  });

  it('MANAGE-BE-R1 고친 카테고리·스타일·키워드·설명이 상세에 그대로 보인다 (L2-01, L2-11)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(1);
    const change = {
      categories: ['WEDDING', 'COUPLE'],
      styles: ['FILM', 'VINTAGE'],
      keywords: ['노을'],
      description: 'QA 바뀐 설명',
    };
    await batch(photographer.token, {
      updates: [{ photoId: photoIds[0], ...change }],
    });
    expect((await api().get(`/photos/${photoIds[0]}`)).body).toMatchObject(
      change,
    );
    expect(
      (await myPhoto(photographer.token, photoIds[0]!)).body,
    ).toMatchObject(change);
  });

  it('MANAGE-BE-R2 삭제한 사진은 포트폴리오·피드에서 사라진다 (L2-04)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(2);
    await batch(photographer.token, {
      deletePhotoIds: [photoIds[1]],
      representativePhotoId: photoIds[0],
    });
    const portfolio = (
      await api()
        .get(`/photographers/${photographer.photographerId}/photos`)
        .set(bearer(photographer.token))
    ).body;
    expect(
      portfolio.items.map(({ photoId }: { photoId: string }) => photoId),
    ).toEqual([photoIds[0]]);
    expect((await api().get(`/photos/${photoIds[1]}`)).status).toBe(404);
  });

  it('MANAGE-BE-R3 대표 사진을 삭제하며 남은 첫 사진을 대표로 보내면 그 사진이 대표가 된다 (L2-06, 화면 동작)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(3);
    const res = await batch(photographer.token, {
      deletePhotoIds: [photoIds[0]],
      representativePhotoId: photoIds[1],
    });
    expect(res.body).toMatchObject({
      deletedCount: 1,
      representativePhotoId: photoIds[1],
      photoCount: 2,
    });
  });

  it('MANAGE-BE-R4 사진을 모두 삭제하면 대표가 없어지고 사진 0장 (L2-07)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(3);
    const res = await batch(photographer.token, { deletePhotoIds: photoIds });
    expect(res.body).toMatchObject({
      deletedCount: 3,
      representativePhotoId: null,
      photoCount: 0,
    });
  });

  it('MANAGE-BE-R5 수정·삭제·대표 변경을 한 번에 보내도 모두 반영된다 (L2-08)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(3);
    const res = await batch(photographer.token, {
      updates: [{ photoId: photoIds[0], description: 'QA 한 번에' }],
      deletePhotoIds: [photoIds[1]],
      representativePhotoId: photoIds[2],
    });
    expect(res.body).toMatchObject({
      updatedCount: 1,
      deletedCount: 1,
      representativePhotoId: photoIds[2],
      photoCount: 2,
    });
    expect(
      (await myPhoto(photographer.token, photoIds[0]!)).body.description,
    ).toBe('QA 한 번에');
  });

  it('MANAGE-BE-R6 25장을 20개·5개 두 번에 나눠 보내면 모두 반영된다 (L2-09, L2-10)', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(25);
    const first = await batch(photographer.token, {
      updates: photoIds
        .slice(0, 20)
        .map((photoId) => ({ photoId, styles: ['FILM'] })),
    });
    const second = await batch(photographer.token, {
      deletePhotoIds: photoIds.slice(20),
      representativePhotoId: photoIds[19],
    });
    expect(first.body.updatedCount).toBe(20);
    expect(second.body).toMatchObject({
      deletedCount: 5,
      representativePhotoId: photoIds[19],
      photoCount: 20,
    });
    const styles = await prisma.photos.findMany({
      where: { photographer_id: photographer.photographerId },
      select: { styles: true },
    });
    styles.forEach((row) => expect(row.styles).toEqual(['FILM']));
  });

  it('MANAGE-L2-13 다른 탭에서 이미 삭제한 사진을 고쳐 저장한 응답을 기록', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(2);
    await batch(photographer.token, {
      deletePhotoIds: [photoIds[1]],
      representativePhotoId: photoIds[0],
    });
    const res = await batch(photographer.token, {
      updates: [{ photoId: photoIds[1], description: 'QA 늦은 수정' }],
    });
    recorder.record('MANAGE-L2-13', {
      status: res.status,
      code: res.body.code ?? null,
    });
  });

  it('MANAGE-L2-15 두 창에서 서로 다른 사진을 대표로 동시에 저장하고, 마지막에 남는 대표를 기록', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(3);
    const [a, b] = await Promise.all([
      batch(photographer.token, { representativePhotoId: photoIds[1] }),
      batch(photographer.token, { representativePhotoId: photoIds[2] }),
    ]);
    const finalRep = await representativeOf(photographer.photographerId);
    recorder.record('MANAGE-L2-15', {
      '창 A(2번째 사진)': a.status,
      '창 B(3번째 사진)': b.status,
      '남은 대표':
        finalRep === photoIds[1]
          ? '2번째 사진'
          : finalRep === photoIds[2]
            ? '3번째 사진'
            : finalRep,
    });
    expect([photoIds[1], photoIds[2]]).toContain(finalRep);
  });
});

// ---------------------------------------------------------------------------
describe('MANAGE BE · 수정용 정보 GET /me/photos/{id}', () => {
  it('MANAGE-BE-14 정상 요청이면 imageUrl, 카테고리·스타일·키워드·설명, isRepresentative', async () => {
    const { photographer, photoIds } = await photographerWithPhotos(2);
    const res = await myPhoto(photographer.token, photoIds[0]!);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      photoId: photoIds[0],
      imageUrl: expect.any(String),
      categories: ['PROFILE'],
      styles: ['NATURAL'],
      keywords: ['하나', '둘'],
      description: 'QA 설명 1',
      isRepresentative: true,
    });
    expect(
      (await myPhoto(photographer.token, photoIds[1]!)).body.isRepresentative,
    ).toBe(false);
  });

  it('MANAGE-BE-15 UUID가 아니면 400 VALIDATION_FAILED, 없는 사진이면 404 PHOTO_NOT_FOUND', async () => {
    const { photographer } = await photographerWithPhotos(1);
    const invalid = await myPhoto(photographer.token, 'not-a-uuid');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    const missing = await myPhoto(photographer.token, randomUUID());
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('PHOTO_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
describe('MANAGE AC · 접근 제어', () => {
  let owner: { photographer: Photographer; photoIds: string[] };
  let other: { photographer: Photographer; photoIds: string[] };
  beforeAll(async () => {
    owner = await photographerWithPhotos(2);
    other = await photographerWithPhotos(2);
  });

  it('MANAGE-AC-01 비로그인이면 batch·수정용 정보 모두 401 UNAUTHORIZED', async () => {
    for (const res of [
      await batch(null, { deletePhotoIds: [owner.photoIds[1]] }),
      await myPhoto(null, owner.photoIds[0]!),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('MANAGE-AC-02 일반 토큰이면 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    for (const res of [
      await batch(u1.token, { deletePhotoIds: [owner.photoIds[1]] }),
      await myPhoto(u1.token, owner.photoIds[0]!),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
    }
  });

  it('MANAGE-AC-03 다른 작가 사진을 updates에 넣으면 403 FORBIDDEN, 같이 보낸 내 사진도 바뀌지 않는다', async () => {
    const res = await batch(owner.photographer.token, {
      updates: [
        { photoId: owner.photoIds[0], description: 'QA 바뀌면 안 됨' },
        { photoId: other.photoIds[0], description: 'QA 남의 사진' },
      ],
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(
      (
        await prisma.photos.findUniqueOrThrow({
          where: { id: owner.photoIds[0]! },
        })
      ).description,
    ).toBe('QA 설명 1');
    expect(
      (
        await prisma.photos.findUniqueOrThrow({
          where: { id: other.photoIds[0]! },
        })
      ).description,
    ).toBe('QA 설명 1');
  });

  it('MANAGE-AC-04 다른 작가 사진을 deletePhotoIds에 넣으면 403 FORBIDDEN, 아무것도 지워지지 않는다', async () => {
    const res = await batch(owner.photographer.token, {
      deletePhotoIds: [owner.photoIds[1], other.photoIds[1]],
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(await photoCountOf(owner.photographer.photographerId)).toBe(2);
    expect(await photoCountOf(other.photographer.photographerId)).toBe(2);
  });

  it('MANAGE-AC-05 다른 작가 사진을 representativePhotoId로 보내면 400 INVALID_REPRESENTATIVE', async () => {
    const res = await batch(owner.photographer.token, {
      representativePhotoId: other.photoIds[0],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_REPRESENTATIVE');
    expect(await representativeOf(owner.photographer.photographerId)).toBe(
      owner.photoIds[0],
    );
  });

  it('MANAGE-AC-06 다른 작가 사진의 수정용 정보는 403 FORBIDDEN', async () => {
    const res = await myPhoto(owner.photographer.token, other.photoIds[0]!);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});
