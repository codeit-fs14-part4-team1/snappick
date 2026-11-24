import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { prisma } from '../lib/prisma.js';

type ReservationStatus =
  | 'CONFIRMED'
  | 'SHOOT_COMPLETED'
  | 'DELIVERED'
  | 'PURCHASE_CONFIRMED'
  | 'CANCELED';

type PreviewReservation = {
  id: string;
  quoteId: string;
  status: ReservationStatus;
  quoteName: string;
  shootAt: string;
  location: string;
  // 예약 상세 지도 표시용 촬영 장소 좌표
  locationLat: number;
  locationLng: number;
  totalAmount: number;
  durationMinutes: number;
  photoCount: number;
  includesOriginal: boolean;
  // 지난 예약의 진행 날짜 순서를 맞출 때만 넣는다 (없으면 시드 실행 시각)
  createdAt?: string;
  purchaseConfirmedAt?: string;
  cancelRequest?: {
    id: string;
    status: 'PENDING' | 'ACCEPTED';
    reason: string;
    // 작가가 수락할 때의 사유 (ACCEPTED일 때만)
    acceptReason?: string;
  };
  deliverable?: {
    id: string;
    link: string;
    expirationPeriod: string;
    notice: string | null;
    // 최초 전달 시각 (없으면 시드 실행 시각)
    createdAt?: string;
  };
};

type PreviewSeedData = {
  userId: string;
  photographerId: string;
  userAuthAccountId: string;
  reservations: PreviewReservation[];
};

// 로컬 개발 DB에서만 실행하도록 제한함
function assertLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || process.env.NODE_ENV === 'production') {
    throw new Error('로컬 개발용 DATABASE_URL 설정이 필요합니다.');
  }

  const url = new URL(databaseUrl);
  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (!localHosts.includes(url.hostname) || databaseName !== 'snappick') {
    throw new Error('로컬 snappick DB에서만 실행할 수 있습니다.');
  }
}

// 테스트 데이터의 기본 구조와 중복 ID를 검사함
function validateSeedData(data: PreviewSeedData) {
  if (!data.userId || !data.photographerId || !data.userAuthAccountId) {
    throw new Error('테스트 계정 UUID 3개를 확인해 주세요.');
  }

  if (!Array.isArray(data.reservations) || data.reservations.length !== 6) {
    throw new Error('테스트 예약은 정확히 6건이어야 합니다.');
  }

  const expectedStatuses: Record<ReservationStatus, number> = {
    CONFIRMED: 2,
    SHOOT_COMPLETED: 1,
    DELIVERED: 1,
    PURCHASE_CONFIRMED: 1,
    CANCELED: 1,
  };

  const ids: string[] = [];

  for (const reservation of data.reservations) {
    if (!(reservation.status in expectedStatuses)) {
      throw new Error('지원하지 않는 예약 상태가 있습니다.');
    }

    expectedStatuses[reservation.status] -= 1;

    ids.push(reservation.id, reservation.quoteId);

    if (reservation.cancelRequest) {
      ids.push(reservation.cancelRequest.id);
    }

    if (reservation.deliverable) {
      ids.push(reservation.deliverable.id);
    }

    if (Number.isNaN(new Date(reservation.shootAt).getTime())) {
      throw new Error('촬영 날짜 형식이 올바르지 않습니다.');
    }

    if (
      reservation.status === 'CONFIRMED' &&
      new Date(reservation.shootAt) <= new Date()
    ) {
      throw new Error('예약 확정 데이터의 촬영일은 미래여야 합니다.');
    }

    if (
      (reservation.status === 'PURCHASE_CONFIRMED') !==
      Boolean(reservation.purchaseConfirmedAt)
    ) {
      throw new Error('구매 확정 시각은 구매 확정 예약에만 필요합니다.');
    }

    if (
      reservation.deliverable &&
      (Number.isNaN(
        new Date(reservation.deliverable.expirationPeriod).getTime(),
      ) ||
        !reservation.deliverable.link.startsWith('https://'))
    ) {
      throw new Error('결과물 링크 또는 만료일을 확인해 주세요.');
    }
  }

  if (Object.values(expectedStatuses).some((count) => count !== 0)) {
    throw new Error('예약 상태별 테스트 건수가 올바르지 않습니다.');
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error('테스트 데이터에 중복 UUID가 있습니다.');
  }

  const pendingCount = data.reservations.filter(
    (reservation) =>
      reservation.status === 'CONFIRMED' &&
      reservation.cancelRequest?.status === 'PENDING',
  ).length;

  if (
    pendingCount !== 1 ||
    data.reservations.filter((item) => item.cancelRequest).length !== 2 ||
    data.reservations.filter((item) => item.deliverable).length !== 2
  ) {
    throw new Error('취소 요청 또는 결과물 테스트 구성을 확인해 주세요.');
  }
}

// 기존 USER·작가·인증 계정이 올바르게 연결되어 있는지 확인함
async function validateAccounts(data: PreviewSeedData) {
  const [user, photographer, account] = await Promise.all([
    prisma.users.findUnique({ where: { id: data.userId } }),
    prisma.photographers.findUnique({
      where: { id: data.photographerId },
    }),
    prisma.auth_accounts.findUnique({
      where: { id: data.userAuthAccountId },
    }),
  ]);

  if (!user || !photographer || !account) {
    throw new Error('입력한 USER·사진작가·인증 계정 UUID를 찾을 수 없습니다.');
  }

  // USER와 취소 요청자 인증 계정이 동일한지 확인함
  const userFields = user as unknown as Record<string, unknown>;
  const linkedAccountId = userFields.auth_account_id ?? userFields.account_id;

  if (linkedAccountId !== data.userAuthAccountId) {
    throw new Error('USER와 인증 계정 UUID가 일치하지 않습니다.');
  }
}

// 예약 목록·상세 확인용 데이터를 로컬 DB에 등록함
async function main() {
  assertLocalDatabase();

  const seedFile = new URL(
    '../../prisma/seed-data/snappick-mock-reservations.json',
    import.meta.url,
  );

  const data = JSON.parse(await readFile(seedFile, 'utf-8')) as PreviewSeedData;

  validateSeedData(data);
  await validateAccounts(data);

  let createdCount = 0;
  let skippedCount = 0;

  // 연관 데이터 중 하나라도 실패하면 이번 작업 전체를 롤백함
  await prisma.$transaction(
    async (tx) => {
      for (const reservation of data.reservations) {
        // 같은 ID의 기존 예약은 수정하지 않고 보존함
        const existing = await tx.reservations.findUnique({
          where: { id: reservation.id },
          select: {
            user_id: true,
            photographer_id: true,
            quote_id: true,
          },
        });

        if (existing) {
          if (
            existing.user_id !== data.userId ||
            existing.photographer_id !== data.photographerId ||
            existing.quote_id !== reservation.quoteId
          ) {
            throw new Error('기존 예약 ID가 다른 데이터에 사용 중입니다.');
          }

          skippedCount += 1;
          continue;
        }

        // 견적과 연결할 촬영 건을 생성함
        await tx.shooting_cases.create({
          data: {
            id: reservation.quoteId,
            chat_room_id: null,
          },
        });

        // 촬영 시간·사진 수·예약명을 포함한 견적을 생성함
        await tx.quotes.create({
          data: {
            id: reservation.quoteId,
            shooting_case_id: reservation.quoteId,
            chat_room_id: null,
            photographer_id: data.photographerId,
            quote_name: reservation.quoteName,
            version: 1,
            shoot_at: new Date(reservation.shootAt),
            location: reservation.location,
            location_lat: reservation.locationLat,
            location_lng: reservation.locationLng,
            duration_minutes: reservation.durationMinutes,
            price: reservation.totalAmount,
            photo_count: reservation.photoCount,
            includes_original: reservation.includesOriginal,
            additional_notice: null,
            common_notice: null,
          },
        });

        // 로그인한 USER의 예약을 생성함
        await tx.reservations.create({
          data: {
            id: reservation.id,
            quote_id: reservation.quoteId,
            payment_id: null,
            user_id: data.userId,
            photographer_id: data.photographerId,
            status: reservation.status,
            shoot_at: new Date(reservation.shootAt),
            location: reservation.location,
            total_amount: reservation.totalAmount,
            ...(reservation.createdAt && {
              created_at: new Date(reservation.createdAt),
            }),
            purchase_confirmed_at: reservation.purchaseConfirmedAt
              ? new Date(reservation.purchaseConfirmedAt)
              : null,
          },
        });

        // 취소 요청 중 또는 취소 승인 상태를 생성함
        if (reservation.cancelRequest) {
          const cancel = reservation.cancelRequest;

          await tx.reservation_cancel_requests.create({
            data: {
              id: cancel.id,
              reservation_id: reservation.id,
              requested_by_account_id: data.userAuthAccountId,
              reason: cancel.reason,
              accept_reason: cancel.acceptReason ?? null,
              status: cancel.status,
              processed_at: cancel.status === 'ACCEPTED' ? new Date() : null,
            },
          });
        }

        // 결과물 전달 또는 구매 확정 상태의 결과물 정보를 생성함
        if (reservation.deliverable) {
          const deliverable = reservation.deliverable;

          await tx.deliverables.create({
            data: {
              id: deliverable.id,
              reservation_id: reservation.id,
              link: deliverable.link,
              expiration_period: new Date(deliverable.expirationPeriod),
              notice: deliverable.notice,
              ...(deliverable.createdAt && {
                created_at: new Date(deliverable.createdAt),
              }),
            },
          });
        }

        createdCount += 1;
      }
    },
    { timeout: 20000 },
  );

  console.log('예약 UI 테스트 데이터 등록 완료');
  console.log(`새로 생성한 예약: ${createdCount}건`);
  console.log(`기존 예약 유지: ${skippedCount}건`);
  console.log('Prisma Studio 또는 /my/reservations에서 확인하세요.');
}

main()
  .catch((error: unknown) => {
    console.error('예약 테스트 데이터 등록 실패:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
