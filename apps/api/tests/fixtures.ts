/**
 * 테스트 데이터(TD)를 테스트 DB에 만드는 함수
 * QA 문서의 TD 계정은 로컬에 없으므로, 필요한 상태를 테스트마다 직접 만든다
 */
import { randomBytes } from 'node:crypto';
import type { ReservationStatus } from '../src/generated/prisma/enums.js';
import { prisma } from '../src/lib/prisma.js';
import { tokenFor } from './helpers.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

// 닉네임은 전체에서 겹칠 수 없어 뒤에 임의 값을 붙인다
const uniqueNickname = (prefix: string) =>
  `${prefix}_${randomBytes(3).toString('hex')}`;

/** 일반 계정 (예약·결제 없는 새 계정) */
export async function createUserAccount(prefix = 'QA유저') {
  const account = await prisma.auth_accounts.create({
    data: { account_type: 'USER', nickname: uniqueNickname(prefix) },
  });
  const user = await prisma.users.create({
    data: { auth_account_id: account.id },
  });
  return {
    userId: user.id,
    accountId: account.id,
    nickname: account.nickname,
    token: await tokenFor(account.id),
  };
}

/** 작가 계정 (예약·결제 없는 새 계정) */
export async function createPhotographerAccount(prefix = 'QA작가') {
  const account = await prisma.auth_accounts.create({
    data: { account_type: 'PHOTOGRAPHER', nickname: uniqueNickname(prefix) },
  });
  const photographer = await prisma.photographers.create({
    data: {
      auth_account_id: account.id,
      regions: ['SEOUL'],
      categories: ['PROFILE'],
      introduction: 'QA 작가',
    },
  });
  return {
    photographerId: photographer.id,
    accountId: account.id,
    nickname: account.nickname,
    token: await tokenFor(account.id),
  };
}

/**
 * 일반 사용자와 작가의 채팅방에 새 촬영 건을 만들고 견적을 versions개 발행한다
 * 마지막 버전이 최신 견적
 */
export async function createQuoteCase(options: {
  userId: string;
  photographerId: string;
  price?: number;
  shootAt?: Date;
  versions?: number;
  name?: string;
}) {
  const {
    userId,
    photographerId,
    price = 150_000,
    shootAt = new Date(Date.now() + 30 * DAY_MS),
    versions = 1,
    name = 'QA 견적',
  } = options;
  const room = await prisma.chat_rooms.upsert({
    where: {
      user_id_photographer_id: {
        user_id: userId,
        photographer_id: photographerId,
      },
    },
    create: { user_id: userId, photographer_id: photographerId },
    update: {},
  });
  const shootingCase = await prisma.shooting_cases.create({
    data: { chat_room_id: room.id },
  });
  const quotes = [];
  for (let version = 1; version <= versions; version++) {
    quotes.push(
      await prisma.quotes.create({
        data: {
          chat_room_id: room.id,
          shooting_case_id: shootingCase.id,
          photographer_id: photographerId,
          quote_name: `${name} v${version}`,
          version,
          shoot_at: shootAt,
          location: '서울 성수동',
          location_lat: 37.54,
          location_lng: 127.05,
          duration_minutes: 120,
          price,
          photo_count: 30,
          includes_original: true,
        },
      }),
    );
  }
  return {
    roomId: room.id,
    shootingCaseId: shootingCase.id,
    quotes,
    latest: quotes.at(-1)!,
  };
}

/** 최신 견적에 결제 기록을 만든다 (결제창·토스를 거치지 않음) */
export async function createPayment(options: {
  userId: string;
  photographerId: string;
  status: 'READY' | 'PENDING' | 'SUCCEEDED' | 'FAILED';
  price?: number;
}) {
  const { latest } = await createQuoteCase(options);
  return prisma.payments.create({
    data: {
      quote_id: latest.id,
      user_id: options.userId,
      photographer_id: options.photographerId,
      amount: latest.price,
      payment_method: 'EASY_PAY',
      pg_provider: 'TOSS',
      status: options.status,
      ...(options.status === 'SUCCEEDED' && { paid_at: new Date() }),
    },
  });
}

/**
 * 예약을 DB로 바로 만든다 (견적 + 성공 결제 + 예약)
 * 상태·만든 시각·촬영 일시를 정해 목록 정렬과 탭 분류를 확인할 때 쓴다
 */
export async function createReservationRecord(options: {
  userId: string;
  photographerId: string;
  status: ReservationStatus;
  createdAt: Date;
  shootAt?: Date;
  name?: string;
}) {
  const { latest } = await createQuoteCase(options);
  const payment = await prisma.payments.create({
    data: {
      quote_id: latest.id,
      user_id: options.userId,
      photographer_id: options.photographerId,
      amount: latest.price,
      payment_method: 'EASY_PAY',
      pg_provider: 'TOSS',
      status: 'SUCCEEDED',
      paid_at: options.createdAt,
    },
  });
  return prisma.reservations.create({
    data: {
      quote_id: latest.id,
      payment_id: payment.id,
      user_id: options.userId,
      photographer_id: options.photographerId,
      status: options.status,
      shoot_at: latest.shoot_at,
      location: latest.location,
      total_amount: latest.price,
      created_at: options.createdAt,
    },
  });
}
