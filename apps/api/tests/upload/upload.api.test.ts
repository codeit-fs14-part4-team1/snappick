/**
 * UPLOAD QA 체크리스트: BE 서버 규칙 · AC 접근 제어
 * - 테스트 이름 앞의 ID가 QA 문서의 체크 줄 ID다
 * - 화면과 같은 순서로 확인한다: 업로드 주소 발급 → 그 주소로 파일 PUT → 등록
 * - 이미지는 sharp로 그 자리에서 만든다. 저장소는 로컬(apps/web/public)이고 끝나면 테스트 작가의 파일을 지운다
 * - BE-R* 줄은 QA 문서의 L2 줄 중 서버 응답으로 판정할 수 있는 부분이다
 */
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { api, bearer, createRecorder } from '../helpers.js';
import { createPhotographerAccount, createUserAccount } from '../fixtures.js';

type Photographer = Awaited<ReturnType<typeof createPhotographerAccount>>;

const recorder = createRecorder('UPLOAD BE · AC');
const PUBLIC_DIR = fileURLToPath(
  new URL('../../../web/public/', import.meta.url),
);
const MAX = 20 * 1024 * 1024;

const created: Photographer[] = [];
let u1: Awaited<ReturnType<typeof createUserAccount>>;

/** 기본 정보를 다 채운 작가 */
async function readyPhotographer(prefix = 'QA업로드') {
  const photographer = await createPhotographerAccount(prefix);
  await prisma.photographers.update({
    where: { id: photographer.photographerId },
    data: { profile_image_url: 'qa/profile.webp', career: 2 },
  });
  created.push(photographer);
  return photographer;
}

beforeAll(async () => {
  u1 = await createUserAccount('QA업로드U1');
});

afterAll(async () => {
  // 테스트 작가가 올린 임시 원본·보관본을 지운다
  for (const { photographerId } of created) {
    await rm(`${PUBLIC_DIR}uploads/${photographerId}`, {
      recursive: true,
      force: true,
    });
    await rm(`${PUBLIC_DIR}photos/${photographerId}`, {
      recursive: true,
      force: true,
    });
  }
  recorder.print();
  await prisma.$disconnect();
});

const png = (width = 640, height = 480) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 160, b: 200 },
    },
  })
    .png()
    .toBuffer();

type FileSpec = { fileName: string; contentType: string; fileSize: number };
const fileSpec = (
  body: Buffer,
  fileName = 'qa.png',
  contentType = 'image/png',
): FileSpec => ({
  fileName,
  contentType,
  fileSize: body.length,
});

/** policy를 생략하면 동의(true)로 보낸다. { } 를 넘기면 policyAgreed 없이 보낸다 */
const uploadUrls = (
  token: string | null,
  files: unknown,
  policy: { policyAgreed?: unknown } = { policyAgreed: true },
) => {
  const req = api()
    .post('/me/photos/upload-urls')
    .send({ ...policy, files });
  return token ? req.set(bearer(token)) : req;
};

/** 발급받은 주소로 파일을 올린다 (로컬 저장소의 PUT /storage/local/...) */
const putFile = (uploadUrl: string, body: Buffer, contentType: string) =>
  api()
    .put(uploadUrl.slice(uploadUrl.indexOf('/storage/local/')))
    .set('Content-Type', contentType)
    .send(body);

/** 이미지 하나를 주소 발급부터 올리기까지 마치고 uploadKey를 돌려준다 */
async function uploaded(
  p: Photographer,
  body?: Buffer,
  contentType = 'image/png',
) {
  const data = body ?? (await png());
  const res = await uploadUrls(p.token, [
    fileSpec(data, 'qa.png', contentType),
  ]);
  expect(res.status).toBe(200);
  const item = res.body.items[0];
  expect(
    (await putFile(item.uploadUrl, data, contentType)).status,
  ).toBeLessThan(300);
  return item.uploadKey as string;
}

const register = (
  token: string | null,
  items: Record<string, unknown>[],
  representativeUploadKey?: string,
) => {
  const req = api()
    .post('/me/photos')
    .send({
      items,
      ...(representativeUploadKey && { representativeUploadKey }),
    });
  return token ? req.set(bearer(token)) : req;
};
const item = (uploadKey: string, override: Record<string, unknown> = {}) => ({
  uploadKey,
  categories: ['PROFILE'],
  styles: ['NATURAL'],
  keywords: ['QA'],
  description: 'QA 한 줄 설명',
  ...override,
});

// ---------------------------------------------------------------------------
describe('UPLOAD BE · 업로드 주소 발급 POST /me/photos/upload-urls', () => {
  it('UPLOAD-BE-01 정상 요청이면 파일마다 uploadKey·uploadUrl·10분 뒤 expiresAt', async () => {
    const p = await readyPhotographer();
    const body = await png();
    const before = Date.now();
    const res = await uploadUrls(p.token, [
      fileSpec(body, 'a.png'),
      fileSpec(body, 'b.png'),
    ]);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    for (const entry of res.body.items) {
      expect(entry.uploadKey).toMatch(
        new RegExp(`^uploads/${p.photographerId}/`),
      );
      expect(entry.uploadUrl).toEqual(expect.any(String));
      const ttl = new Date(entry.expiresAt).getTime() - before;
      expect(ttl).toBeGreaterThan(9.9 * 60_000);
      expect(ttl).toBeLessThanOrEqual(10 * 60_000 + 5_000);
    }
  });

  it.each([
    ['없음', {}],
    ['false', { policyAgreed: false }],
    ['문자열 "true"', { policyAgreed: 'true' }],
  ])(
    'UPLOAD-BE-02 policyAgreed가 %s이면 400 POLICY_NOT_AGREED',
    async (_label, policy) => {
      const p = await readyPhotographer();
      const res = await uploadUrls(p.token, [fileSpec(await png())], policy);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('POLICY_NOT_AGREED');
    },
  );

  it('UPLOAD-BE-03 기본 정보를 덜 채운 작가면 403 PHOTOGRAPHER_NOT_READY와 missing (L2-16)', async () => {
    const notReady = await createPhotographerAccount('QA업로드준비중');
    created.push(notReady);
    const res = await uploadUrls(notReady.token, [fileSpec(await png())]);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'PHOTOGRAPHER_NOT_READY',
      details: { missing: ['profileImage', 'career'] },
    });
  });

  it('UPLOAD-BE-04 파일 21개면 400 VALIDATION_FAILED, 20개는 받는다', async () => {
    const p = await readyPhotographer();
    const spec = fileSpec(await png());
    expect(
      (
        await uploadUrls(
          p.token,
          Array.from({ length: 21 }, () => spec),
        )
      ).body.code,
    ).toBe('VALIDATION_FAILED');
    expect(
      (
        await uploadUrls(
          p.token,
          Array.from({ length: 20 }, () => spec),
        )
      ).status,
    ).toBe(200);
  });

  it('UPLOAD-BE-05 이름 256자는 400 VALIDATION_FAILED, 허용하지 않는 형식·20MB 초과는 400 INVALID_FILE', async () => {
    const p = await readyPhotographer();
    const longName = await uploadUrls(p.token, [
      {
        fileName: `${'a'.repeat(252)}.png`,
        contentType: 'image/png',
        fileSize: 1000,
      },
    ]);
    expect(longName.status).toBe(400);
    expect(longName.body.code).toBe('VALIDATION_FAILED');

    for (const file of [
      { fileName: 'a.gif', contentType: 'image/gif', fileSize: 1000 },
      { fileName: 'a.heic', contentType: 'image/heic', fileSize: 1000 },
      { fileName: 'big.png', contentType: 'image/png', fileSize: MAX + 1 },
    ]) {
      const res = await uploadUrls(p.token, [file]);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_FILE');
    }
  });

  it('UPLOAD-BE-05b 이름 255자, 정확히 20MB, 한글·공백 이름은 받는다 (L1-07 경계, L2-14)', async () => {
    const p = await readyPhotographer();
    const res = await uploadUrls(p.token, [
      {
        fileName: `${'a'.repeat(251)}.jpg`,
        contentType: 'image/jpeg',
        fileSize: MAX,
      },
      {
        fileName: '촬영 테스트 사진 01.jpg',
        contentType: 'image/jpeg',
        fileSize: 1000,
      },
    ]);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('UPLOAD BE · 사진 등록 POST /me/photos', () => {
  it('UPLOAD-BE-R1 올린 사진을 등록하면 201, 입력한 정보가 상세에 그대로, 피드 최신순 맨 앞에 나온다 (L2-01~03)', async () => {
    const p = await readyPhotographer();
    const key = await uploaded(p);
    const res = await register(p.token, [
      item(key, {
        categories: ['PROFILE', 'WEDDING'],
        styles: ['NATURAL', 'FILM'],
        keywords: ['노을', 'QA'],
        description: 'QA 노을 프로필',
      }),
    ]);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ failed: [], photoCount: 1 });
    const photoId = res.body.items[0].photoId as string;

    const detail = (await api().get(`/photos/${photoId}`)).body;
    expect(detail).toMatchObject({
      categories: ['PROFILE', 'WEDDING'],
      styles: ['NATURAL', 'FILM'],
      keywords: ['노을', 'QA'],
      description: 'QA 노을 프로필',
    });
    const feed = (await api().get('/photos?sort=latest&limit=5')).body.items;
    expect(feed[0].photoId).toBe(photoId);
  });

  it.each(
    [
      ['카테고리 없음', { categories: [] }, 'CATEGORY_REQUIRED'],
      ['없는 카테고리', { categories: ['SPACE'] }, 'INVALID_CATEGORY'],
      [
        '스타일 4개',
        { styles: ['NATURAL', 'BRIGHT', 'FILM', 'VINTAGE'] },
        'TOO_MANY_STYLES',
      ],
      ['없는 스타일', { styles: ['NEON'] }, 'INVALID_STYLE'],
      [
        '키워드 6개',
        { keywords: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'] },
        'INVALID_KEYWORD',
      ],
      ['키워드 11자', { keywords: ['가'.repeat(11)] }, 'INVALID_KEYWORD'],
      ['키워드 공백 포함', { keywords: ['노을 사진'] }, 'INVALID_KEYWORD'],
      [
        '같은 카테고리 두 번',
        { categories: ['PROFILE', 'PROFILE'] },
        'DUPLICATE_VALUE',
      ],
      ['같은 스타일 두 번', { styles: ['FILM', 'FILM'] }, 'DUPLICATE_VALUE'],
      ['같은 키워드 두 번', { keywords: ['QA', 'QA'] }, 'DUPLICATE_VALUE'],
      ['설명 51자', { description: '가'.repeat(51) }, 'INVALID_DESCRIPTION'],
      // 테스트 이름에 오류 코드가 보이도록 [이름, 코드, 입력값] 순서로 바꾼다
    ].map(
      ([label, override, code]) =>
        [label, code, override] as [string, string, Record<string, unknown>],
    ),
  )(
    'UPLOAD-BE-06~10 %s이면 400 %s, 아무것도 등록되지 않는다',
    async (_label, code, override) => {
      const p = await readyPhotographer();
      const key = await uploaded(p);
      const res = await register(p.token, [item(key, override)]);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(code);
      expect(
        await prisma.photos.count({
          where: { photographer_id: p.photographerId },
        }),
      ).toBe(0);
    },
  );

  it('UPLOAD-BE-06~10b 경계값(스타일 3개, 키워드 5개·10자, 설명 50자)은 받는다', async () => {
    const p = await readyPhotographer();
    const key = await uploaded(p);
    const res = await register(p.token, [
      item(key, {
        styles: ['NATURAL', 'BRIGHT', 'FILM'],
        keywords: ['가'.repeat(10), 'b', 'c', 'd', 'e'],
        description: '가'.repeat(50),
      }),
    ]);
    expect(res.status).toBe(201);
  });

  it('UPLOAD-BE-11 등록 목록에 없는 representativeUploadKey면 400 INVALID_REPRESENTATIVE', async () => {
    const p = await readyPhotographer();
    const key = await uploaded(p);
    const other = await uploaded(p);
    const res = await register(p.token, [item(key)], other);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_REPRESENTATIVE');
  });

  it('UPLOAD-BE-R2 대표로 지정한 사진이 대표가 되고, 지정하지 않으면 기존 대표가 유지된다 (L2-04, L2-05)', async () => {
    const p = await readyPhotographer();
    const first = await uploaded(p);
    const withRep = await register(p.token, [item(first)], first);
    const repId = withRep.body.items[0].photoId;
    expect(withRep.body.representativePhotoId).toBe(repId);

    const second = await uploaded(p);
    const withoutRep = await register(p.token, [item(second)]);
    expect(withoutRep.body.representativePhotoId).toBe(repId);
  });

  it('UPLOAD-BE-12 발급만 받고 올리지 않은 uploadKey가 섞이면 201, 그 키만 failed에 UPLOAD_NOT_FOUND', async () => {
    const p = await readyPhotographer();
    const ok = await uploaded(p);
    const notUploaded = (await uploadUrls(p.token, [fileSpec(await png())]))
      .body.items[0].uploadKey;
    const res = await register(p.token, [item(ok), item(notUploaded)]);
    expect(res.status).toBe(201);
    expect(
      res.body.items.map(({ uploadKey }: { uploadKey: string }) => uploadKey),
    ).toEqual([ok]);
    expect(res.body.failed).toEqual([
      expect.objectContaining({
        uploadKey: notUploaded,
        code: 'UPLOAD_NOT_FOUND',
      }),
    ]);
  });

  it('UPLOAD-BE-15 형식이 틀린 임의의 uploadKey가 섞이면 요청 전체가 404 UPLOAD_NOT_FOUND, 아무것도 등록되지 않는다', async () => {
    const p = await readyPhotographer();
    const ok = await uploaded(p);
    const res = await register(p.token, [
      item(ok),
      item('uploads/not-a-real-key.png'),
    ]);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('UPLOAD_NOT_FOUND');
    expect(
      await prisma.photos.count({
        where: { photographer_id: p.photographerId },
      }),
    ).toBe(0);
  });

  it('UPLOAD-BE-13 이미지가 아닌 파일(확장자만 .png)을 올린 uploadKey는 failed에 INVALID_FILE (L2-12)', async () => {
    const p = await readyPhotographer();
    const fake = Buffer.from('GIF89a 이건 이미지가 아니에요');
    const key = await uploaded(p, fake);
    const res = await register(p.token, [item(key)]);
    expect(res.status).toBe(201);
    expect(res.body.items).toEqual([]);
    expect(res.body.failed).toEqual([
      expect.objectContaining({ uploadKey: key, code: 'INVALID_FILE' }),
    ]);
  });

  it('UPLOAD-BE-14 이미 등록한 uploadKey로 다시 등록하면 201과 같은 photoId, 새 사진은 생기지 않는다', async () => {
    const p = await readyPhotographer();
    const key = await uploaded(p);
    const first = await register(p.token, [item(key)]);
    const again = await register(p.token, [item(key)]);
    expect(again.status).toBe(201);
    expect(again.body.items[0].photoId).toBe(first.body.items[0].photoId);
    expect(
      await prisma.photos.count({
        where: { photographer_id: p.photographerId },
      }),
    ).toBe(1);
  });

  it('UPLOAD-BE-16 한 요청에 같은 uploadKey를 두 번 넣으면 400 VALIDATION_FAILED', async () => {
    const p = await readyPhotographer();
    const key = await uploaded(p);
    const res = await register(p.token, [item(key), item(key)]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('UPLOAD-BE-R3 휴대폰 세로 사진(회전 정보)은 돌려서 저장하고, 긴 변 4500px은 2048px 이하로 줄인다 (L2-06, L2-07)', async () => {
    const p = await readyPhotographer();
    // 가로 600×400으로 저장됐지만 회전 정보(6 = 90도)가 붙은 사진 → 세로 400×600으로 보여야 한다
    const rotated = await sharp({
      create: { width: 600, height: 400, channels: 3, background: '#888' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const big = await png(4500, 3000);
    const rotatedKey = await uploaded(p, rotated, 'image/jpeg');
    const bigKey = await uploaded(p, big);
    const res = await register(p.token, [item(rotatedKey), item(bigKey)]);
    const byKey = new Map(
      res.body.items.map((row: { uploadKey: string }) => [row.uploadKey, row]),
    );
    expect(byKey.get(rotatedKey)).toMatchObject({ width: 400, height: 600 });
    const bigRow = byKey.get(bigKey) as { width: number; height: number };
    expect(Math.max(bigRow.width, bigRow.height)).toBeLessThanOrEqual(2048);
  });

  it('UPLOAD-BE-R4 같은 작가가 두 창에서 동시에 등록해도 두 쪽 사진이 모두 등록된다 (L2-18)', async () => {
    const p = await readyPhotographer();
    const [a, b] = [await uploaded(p), await uploaded(p)];
    const results = await Promise.all([
      register(p.token, [item(a)]),
      register(p.token, [item(b)]),
    ]);
    results.forEach(({ status }) => expect(status).toBe(201));
    expect(
      await prisma.photos.count({
        where: { photographer_id: p.photographerId },
      }),
    ).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe('UPLOAD AC · 접근 제어', () => {
  it('UPLOAD-AC-01 비로그인이면 주소 발급·등록 모두 401 UNAUTHORIZED', async () => {
    for (const res of [
      await uploadUrls(null, [fileSpec(await png())]),
      await register(null, [item('uploads/x.png')]),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('UPLOAD-AC-02 일반 토큰이면 주소 발급·등록 모두 403 ACCOUNT_TYPE_NOT_ALLOWED', async () => {
    for (const res of [
      await uploadUrls(u1.token, [fileSpec(await png())]),
      await register(u1.token, [item('uploads/x.png')]),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_TYPE_NOT_ALLOWED');
    }
  });

  it('UPLOAD-AC-03 다른 작가가 받은 uploadKey로 등록하면 404 UPLOAD_NOT_FOUND, 아무것도 등록되지 않는다', async () => {
    const owner = await readyPhotographer('QA업로드주인');
    const other = await readyPhotographer('QA업로드남');
    const key = await uploaded(owner);
    const res = await register(other.token, [item(key)]);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('UPLOAD_NOT_FOUND');
    expect(
      await prisma.photos.count({
        where: { photographer_id: other.photographerId },
      }),
    ).toBe(0);
    expect(
      await prisma.photos.count({
        where: { photographer_id: owner.photographerId },
      }),
    ).toBe(0);
  });
});
