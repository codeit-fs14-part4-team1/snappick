import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

type MockData = {
  auth_accounts: Prisma.auth_accountsCreateManyInput[];
  auth_providers: Prisma.auth_providersCreateManyInput[];
  users: Prisma.usersCreateManyInput[];
  photographers: (Prisma.photographersCreateManyInput & { id: string })[];
  products: (Prisma.productsCreateManyInput & { id: string })[];
  photos: (Prisma.photosCreateManyInput & { id: string })[];
  photo_keywords: (Prisma.photo_keywordsCreateManyInput & { id: string })[];
  representative_photos: Prisma.representative_photosCreateManyInput[];
  photo_likes: Prisma.photo_likesCreateManyInput[];
  photographer_saves: Prisma.photographer_savesCreateManyInput[];
};

type ProfileMockData = {
  products: (Prisma.productsCreateManyInput & { id: string })[];
  quotes: (Prisma.quotesCreateManyInput & { id: string })[];
  reservations: (Prisma.reservationsCreateManyInput & { id: string })[];
  deliverables: (Prisma.deliverablesCreateManyInput & { id: string })[];
  reviews: (Prisma.reviewsCreateManyInput & { id: string })[];
  review_replies: (Prisma.review_repliesCreateManyInput & { id: string })[];
};

// 예전 목데이터의 비밀번호 자리 (실제 해시가 아니라 로그인할 수 없음)
const LEGACY_PASSWORD_HASH = 'mock-not-a-real-hash';

// 로컬은 DATABASE_URL, staging은 DB_HOST와 DB_CREDENTIALS로 접속한다 (lib/prisma.ts)
// 빌드하면 dist/scripts/seed.js가 되어 배포 hook에서 tsx 없이 실행한다
async function main() {
  const baseFile = new URL(
    '../../prisma/seed-data/snappick-mock.json',
    import.meta.url,
  );
  const profileFile = new URL(
    '../../prisma/seed-data/snappick-mock-profile.json',
    import.meta.url,
  );
  const [data, profileData] = await Promise.all([
    readFile(baseFile, 'utf-8').then((json) => JSON.parse(json) as MockData),
    readFile(profileFile, 'utf-8').then(
      (json) => JSON.parse(json) as ProfileMockData,
    ),
  ]);

  // 로그인·사용자 계정은 기존 행을 유지한다.
  const accountCounts = await prisma.$transaction([
    prisma.auth_accounts.createMany({
      data: data.auth_accounts,
      skipDuplicates: true,
    }),
    prisma.auth_providers.createMany({
      data: data.auth_providers,
      skipDuplicates: true,
    }),
    prisma.users.createMany({ data: data.users, skipDuplicates: true }),
  ]);

  console.log(`auth_accounts: ${accountCounts[0]?.count ?? 0}건 추가`);
  console.log(`auth_providers: ${accountCounts[1]?.count ?? 0}건 추가`);
  console.log(`users: ${accountCounts[2]?.count ?? 0}건 추가`);

  // 화면에 노출되는 콘텐츠는 재실행할 때 JSON의 최신 문구로 갱신한다.
  await prisma.$transaction([
    ...data.photographers.map(({ id, ...content }) =>
      prisma.photographers.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    ...data.products.map(({ id, ...content }) =>
      prisma.products.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    ...data.photos.map(({ id, ...content }) =>
      prisma.photos.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    ...data.photo_keywords.map(({ id, ...content }) =>
      prisma.photo_keywords.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
  ]);

  console.log(`photographers: ${data.photographers.length}건 동기화`);
  console.log(`products: ${data.products.length}건 동기화`);
  console.log(`photos: ${data.photos.length}건 동기화`);
  console.log(`photo_keywords: ${data.photo_keywords.length}건 동기화`);

  const relationCounts = await prisma.$transaction([
    prisma.representative_photos.createMany({
      data: data.representative_photos,
      skipDuplicates: true,
    }),
    prisma.photo_likes.createMany({
      data: data.photo_likes,
      skipDuplicates: true,
    }),
    prisma.photographer_saves.createMany({
      data: data.photographer_saves,
      skipDuplicates: true,
    }),
  ]);

  console.log(`representative_photos: ${relationCounts[0]?.count ?? 0}건 추가`);
  console.log(`photo_likes: ${relationCounts[1]?.count ?? 0}건 추가`);
  console.log(`photographer_saves: ${relationCounts[2]?.count ?? 0}건 추가`);

  // 프로필 화면용 데이터는 기본 사용자·작가 시드가 끝난 뒤 FK 순서로 동기화한다.
  await prisma.$transaction([
    ...profileData.products.map(({ id, ...content }) =>
      prisma.products.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    ...profileData.quotes.map(({ id, ...content }) =>
      prisma.quotes.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    ...profileData.reservations.map(({ id, ...content }) =>
      prisma.reservations.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    ...profileData.deliverables.map(({ id, ...content }) =>
      prisma.deliverables.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    ...profileData.reviews.map(({ id, ...content }) =>
      prisma.reviews.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    ...profileData.review_replies.map(({ id, ...content }) =>
      prisma.review_replies.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
  ]);

  console.log(`profile products: ${profileData.products.length}건 동기화`);
  console.log(`quotes: ${profileData.quotes.length}건 동기화`);
  console.log(`reservations: ${profileData.reservations.length}건 동기화`);
  console.log(`deliverables: ${profileData.deliverables.length}건 동기화`);
  console.log(`reviews: ${profileData.reviews.length}건 동기화`);
  console.log(`review_replies: ${profileData.review_replies.length}건 동기화`);

  // 예전 시드로 넣은 DB는 비밀번호가 임시 값이라 로그인할 수 없다. 임시 값인 계정만 바꾼다
  const updated = await prisma.$transaction(
    data.auth_providers.flatMap(({ id, password_hash }) =>
      id && password_hash
        ? [
            prisma.auth_providers.updateMany({
              where: { id, password_hash: LEGACY_PASSWORD_HASH },
              data: { password_hash },
            }),
          ]
        : [],
    ),
  );
  const fixed = updated.reduce((sum, { count }) => sum + count, 0);
  if (fixed > 0) {
    console.log(`auth_providers: 임시 비밀번호 ${fixed}건 교체`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
