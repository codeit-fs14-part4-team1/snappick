import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

type MockData = {
  auth_accounts: (Prisma.auth_accountsCreateManyInput & { id: string })[];
  auth_providers: Prisma.auth_providersCreateManyInput[];
  users: Prisma.usersCreateManyInput[];
  photographers: (Prisma.photographersCreateManyInput & { id: string })[];
  products: (Prisma.productsCreateManyInput & { id: string })[];
  photos: (Prisma.photosCreateManyInput & { id: string })[];
  photo_keywords: (Prisma.photo_keywordsCreateManyInput & { id: string })[];
  representative_photos: Prisma.representative_photosCreateManyInput[];
  photo_likes: Prisma.photo_likesCreateManyInput[];
  photographer_saves: Prisma.photographer_savesCreateManyInput[];
  notifications: Prisma.notificationsCreateManyInput[];
};

type ProfileMockData = {
  products: (Prisma.productsCreateManyInput & { id: string })[];
  quotes: (Omit<Prisma.quotesCreateManyInput, 'shooting_case_id'> & {
    id: string;
  })[];
  reservations: (Prisma.reservationsCreateManyInput & { id: string })[];
  deliverables: (Prisma.deliverablesCreateManyInput & { id: string })[];
  reviews: (Prisma.reviewsCreateManyInput & { id: string })[];
  review_replies: (Prisma.review_repliesCreateManyInput & { id: string })[];
};

// QA 목데이터 (scripts/mock/generate-qa.ts가 만든다). 기존 목데이터 위에 덧씌우고 deletes의 행을 지운다
type QaMockData = {
  _meta: { anchor_date: string };
  upserts: {
    // 닉네임만 바꿀 계정
    auth_accounts: { id: string; nickname: string }[];
    // 새로 만드는 계정 (탈퇴한 작가처럼 프로필 행이 없는 계정)
    new_auth_accounts: (Prisma.auth_accountsCreateManyInput & {
      id: string;
    })[];
    auth_providers: (Prisma.auth_providersCreateManyInput & { id: string })[];
    users: (Prisma.usersCreateManyInput & { id: string })[];
    photographers: (Prisma.photographersCreateManyInput & { id: string })[];
    products: (Prisma.productsCreateManyInput & { id: string })[];
    photos: (Prisma.photosCreateManyInput & { id: string })[];
    photo_keywords: (Prisma.photo_keywordsCreateManyInput & { id: string })[];
    representative_photos: Prisma.representative_photosCreateManyInput[];
    photo_likes: Prisma.photo_likesCreateManyInput[];
    photographer_saves: Prisma.photographer_savesCreateManyInput[];
    chat_rooms: (Prisma.chat_roomsCreateManyInput & { id: string })[];
    shooting_cases: (Prisma.shooting_casesCreateManyInput & { id: string })[];
    quotes: (Prisma.quotesCreateManyInput & { id: string })[];
    payments: (Prisma.paymentsCreateManyInput & { id: string })[];
    reservations: (Prisma.reservationsCreateManyInput & { id: string })[];
    reservation_cancel_requests: (Prisma.reservation_cancel_requestsCreateManyInput & {
      id: string;
    })[];
    deliverables: (Prisma.deliverablesCreateManyInput & { id: string })[];
    reviews: (Prisma.reviewsCreateManyInput & { id: string })[];
    review_replies: (Prisma.review_repliesCreateManyInput & { id: string })[];
    chat_messages: (Omit<Prisma.chat_messagesCreateManyInput, 'payload'> & {
      id: string;
      payload: Prisma.InputJsonValue | null;
    })[];
    notifications: (Prisma.notificationsCreateManyInput & { id: string })[];
  };
  deletes: {
    notifications: string[];
    photo_keywords_by_photo: string[];
    users: string[];
    products: string[];
    representative_photos: string[];
    photo_likes_by_user: string[];
    photographer_saves_by_user: string[];
  };
};

// 예전 목데이터의 비밀번호 자리 (실제 해시가 아니라 로그인할 수 없음)
const LEGACY_PASSWORD_HASH = 'mock-not-a-real-hash';

const SEED_DATA_DIR = new URL('../../prisma/seed-data/', import.meta.url);

// git에 없는 큰 목데이터 파일은 없을 수 있다
async function readOptional<T>(name: string): Promise<T | null> {
  try {
    const json = await readFile(new URL(name, SEED_DATA_DIR), 'utf-8');
    return JSON.parse(json) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function mergeMockData(
  base: MockData,
  ...extras: (Partial<MockData> | null)[]
): MockData {
  const merged = { ...base };
  for (const extra of extras) {
    if (!extra) continue;
    for (const key of Object.keys(base) as (keyof MockData)[]) {
      const rows = extra[key];
      if (Array.isArray(rows)) {
        merged[key] = [...merged[key], ...rows] as never;
      }
    }
  }
  return merged;
}

// QA 데이터의 날짜를 (오늘 - anchor_date)일만큼 옮긴다. "오늘·내일 촬영" 예약이 시드한 날 기준이 된다
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
function shiftDates<T>(rows: T[], days: number): T[] {
  if (days === 0) return rows;
  return rows.map((row) => {
    const copy = { ...row } as Record<string, unknown>;
    for (const [key, value] of Object.entries(copy)) {
      if (typeof value === 'string' && ISO_DATE_TIME.test(value)) {
        copy[key] = new Date(
          Date.parse(value) + days * 86_400_000,
        ).toISOString();
      }
    }
    return copy as T;
  });
}

function kstDaysSince(anchor: string): number {
  const todayKst = new Date(Date.now() + 9 * 3_600_000)
    .toISOString()
    .slice(0, 10);
  return Math.round(
    (Date.parse(`${todayKst}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) /
      86_400_000,
  );
}

async function seedQa(qa: QaMockData) {
  const days = kstDaysSince(qa._meta.anchor_date);
  const u = Object.fromEntries(
    Object.entries(qa.upserts).map(([key, rows]) => [
      key,
      shiftDates(rows as unknown[], days),
    ]),
  ) as unknown as QaMockData['upserts'];

  const byId = <T extends { id: string }>(
    rows: T[],
    upsert: (args: {
      where: { id: string };
      create: T;
      update: Omit<T, 'id'>;
    }) => Prisma.PrismaPromise<unknown>,
  ) =>
    rows.map(({ id, ...content }) =>
      upsert({
        where: { id },
        create: { id, ...content } as T,
        update: content,
      }),
    );

  // FK 순서로 덧씌운다
  await prisma.$transaction([
    ...u.auth_accounts.map(({ id, nickname }) =>
      prisma.auth_accounts.update({ where: { id }, data: { nickname } }),
    ),
    ...byId(u.new_auth_accounts, (a) => prisma.auth_accounts.upsert(a)),
    ...byId(u.auth_providers, (a) => prisma.auth_providers.upsert(a)),
    ...byId(u.users, (a) => prisma.users.upsert(a)),
    ...byId(u.photographers, (a) => prisma.photographers.upsert(a)),
    ...byId(u.products, (a) => prisma.products.upsert(a)),
    ...byId(u.photos, (a) => prisma.photos.upsert(a)),
    ...byId(u.photo_keywords, (a) => prisma.photo_keywords.upsert(a)),
    ...u.representative_photos.map(({ photographer_id, photo_id }) =>
      prisma.representative_photos.upsert({
        where: { photographer_id },
        create: { photographer_id, photo_id },
        update: { photo_id },
      }),
    ),
    prisma.photo_likes.createMany({
      data: u.photo_likes,
      skipDuplicates: true,
    }),
    prisma.photographer_saves.createMany({
      data: u.photographer_saves,
      skipDuplicates: true,
    }),
    ...byId(u.chat_rooms, (a) => prisma.chat_rooms.upsert(a)),
    ...byId(u.shooting_cases, (a) => prisma.shooting_cases.upsert(a)),
    ...byId(u.quotes, (a) => prisma.quotes.upsert(a)),
    ...byId(u.payments, (a) => prisma.payments.upsert(a)),
    ...byId(u.reservations, (a) => prisma.reservations.upsert(a)),
    ...byId(u.reservation_cancel_requests, (a) =>
      prisma.reservation_cancel_requests.upsert(a),
    ),
    ...byId(u.deliverables, (a) => prisma.deliverables.upsert(a)),
    ...byId(u.reviews, (a) => prisma.reviews.upsert(a)),
    ...byId(u.review_replies, (a) => prisma.review_replies.upsert(a)),
    // payload가 null이면 Json 칸에 넣지 않는다 (Prisma는 Json에 null을 그대로 받지 않는다)
    ...u.chat_messages.map(({ id, payload, ...content }) => {
      const row = payload === null ? content : { ...content, payload };
      return prisma.chat_messages.upsert({
        where: { id },
        create: { id, ...row },
        update: row,
      });
    }),
    ...byId(u.notifications, (a) => prisma.notifications.upsert(a)),
  ]);

  const d = qa.deletes;
  const deleted = await prisma.$transaction([
    // 없는 채팅방·예약을 가리키는 예전 목 알림
    prisma.notifications.deleteMany({ where: { id: { in: d.notifications } } }),
    prisma.photo_keywords.deleteMany({
      where: { photo_id: { in: d.photo_keywords_by_photo } },
    }),
    prisma.photo_likes.deleteMany({
      where: { user_id: { in: d.photo_likes_by_user } },
    }),
    prisma.photographer_saves.deleteMany({
      where: { user_id: { in: d.photographer_saves_by_user } },
    }),
    prisma.representative_photos.deleteMany({
      where: { photographer_id: { in: d.representative_photos } },
    }),
    prisma.products.deleteMany({ where: { id: { in: d.products } } }),
    // 탈퇴 회원: users 행만 지우고 계정은 남긴다
    prisma.users.deleteMany({ where: { id: { in: d.users } } }),
  ]);

  console.log(
    `QA: 날짜 ${days}일 이동, 덧씌움 ${Object.values(u).reduce((sum, rows) => sum + rows.length, 0)}건, 삭제 ${deleted.reduce((sum, { count }) => sum + count, 0)}건`,
  );
}

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
  const [baseData, profileData, catalogData, activityData, qaData] =
    await Promise.all([
      readFile(baseFile, 'utf-8').then((json) => JSON.parse(json) as MockData),
      readFile(profileFile, 'utf-8').then(
        (json) => JSON.parse(json) as ProfileMockData,
      ),
      readOptional<Partial<MockData>>('snappick-mock-catalog.json'),
      readOptional<Partial<MockData>>('snappick-mock-activity.json'),
      readOptional<QaMockData>('snappick-mock-qa.json'),
    ]);
  // 사진 1000장(catalog)과 회원 208명(activity)은 파일이 있을 때만 더한다
  const data = mergeMockData(baseData, catalogData, activityData);

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
    // 작가 닉네임은 계정에 있으므로 따로 갱신한다.
    ...data.auth_accounts
      .filter(({ account_type }) => account_type === 'PHOTOGRAPHER')
      .map(({ id, nickname }) =>
        prisma.auth_accounts.update({ where: { id }, data: { nickname } }),
      ),
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
    prisma.notifications.createMany({
      data: data.notifications,
      skipDuplicates: true,
    }),
  ]);

  console.log(`representative_photos: ${relationCounts[0]?.count ?? 0}건 추가`);
  console.log(`photo_likes: ${relationCounts[1]?.count ?? 0}건 추가`);
  console.log(`photographer_saves: ${relationCounts[2]?.count ?? 0}건 추가`);
  console.log(`notifications: ${relationCounts[3]?.count ?? 0}건 추가`);

  // 프로필 화면용 데이터는 기본 사용자·작가 시드가 끝난 뒤 FK 순서로 동기화한다.
  await prisma.$transaction([
    ...profileData.products.map(({ id, ...content }) =>
      prisma.products.upsert({
        where: { id },
        create: { id, ...content },
        update: content,
      }),
    ),
    // 프로필 목 견적은 모두 별도 촬영 건이므로 견적 ID를 촬영 건 ID로 재사용한다.
    // 고정 ID를 사용해 시드를 다시 실행해도 같은 촬영 건을 참조한다.
    ...profileData.quotes.map(({ id, chat_room_id }) =>
      prisma.shooting_cases.upsert({
        where: { id },
        create: { id, chat_room_id: chat_room_id ?? null },
        update: {},
      }),
    ),
    ...profileData.quotes.map(({ id, ...content }) =>
      prisma.quotes.upsert({
        where: { id },
        create: { id, ...content, shooting_case_id: id },
        update: { ...content, shooting_case_id: id },
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

  if (qaData) {
    await seedQa(qaData);
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
