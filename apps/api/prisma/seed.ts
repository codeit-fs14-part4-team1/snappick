import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';

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
] as const satisfies readonly (keyof MockData)[];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL이 설정되지 않았습니다.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const file = new URL('./seed-data/snappick-mock.json', import.meta.url);
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
  ]);

  TABLES.forEach((table, i) => {
    console.log(`${table}: ${counts[i]?.count ?? 0}건 추가`);
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
