import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

type MockData = {
  auth_accounts: Prisma.auth_accountsCreateManyInput[];
  auth_providers: Prisma.auth_providersCreateManyInput[];
  users: Prisma.usersCreateManyInput[];
  photographers: Prisma.photographersCreateManyInput[];
  products: Prisma.productsCreateManyInput[];
  photos: Prisma.photosCreateManyInput[];
  photo_keywords: Prisma.photo_keywordsCreateManyInput[];
  representative_photos: Prisma.representative_photosCreateManyInput[];
  photo_likes: Prisma.photo_likesCreateManyInput[];
  photographer_saves: Prisma.photographer_savesCreateManyInput[];
  notifications: Prisma.notificationsCreateManyInput[];
};

// 넣는 순서 (FK 순서)
const TABLES = [
  'auth_accounts',
  'auth_providers',
  'users',
  'photographers',
  'products',
  'photos',
  'photo_keywords',
  'representative_photos',
  'photo_likes',
  'photographer_saves',
  'notifications',
] as const satisfies readonly (keyof MockData)[];

// 예전 목데이터의 비밀번호 자리 (실제 해시가 아니라 로그인할 수 없음)
const LEGACY_PASSWORD_HASH = 'mock-not-a-real-hash';

// 로컬은 DATABASE_URL, staging은 DB_HOST와 DB_CREDENTIALS로 접속한다 (lib/prisma.ts)
// 빌드하면 dist/scripts/seed.js가 되어 배포 hook에서 tsx 없이 실행한다
async function main() {
  const file = new URL(
    '../../prisma/seed-data/snappick-mock.json',
    import.meta.url,
  );
  const data = JSON.parse(await readFile(file, 'utf-8')) as MockData;

  // FK 순서대로 넣고, 이미 있는 행은 건너뛰어 여러 번 실행해도 결과가 같게 한다
  const counts = await prisma.$transaction([
    prisma.auth_accounts.createMany({
      data: data.auth_accounts,
      skipDuplicates: true,
    }),
    prisma.auth_providers.createMany({
      data: data.auth_providers,
      skipDuplicates: true,
    }),
    prisma.users.createMany({ data: data.users, skipDuplicates: true }),
    prisma.photographers.createMany({
      data: data.photographers,
      skipDuplicates: true,
    }),
    prisma.products.createMany({ data: data.products, skipDuplicates: true }),
    prisma.photos.createMany({ data: data.photos, skipDuplicates: true }),
    prisma.photo_keywords.createMany({
      data: data.photo_keywords,
      skipDuplicates: true,
    }),
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
    prisma.notifications.createMany({
      data: data.notifications,
      skipDuplicates: true,
    }),
  ]);

  TABLES.forEach((table, i) => {
    console.log(`${table}: ${counts[i]?.count ?? 0}건 추가`);
  });

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
