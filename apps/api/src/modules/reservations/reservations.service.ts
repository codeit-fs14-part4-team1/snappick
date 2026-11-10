import { prisma } from '../../lib/prisma.js';
import {
  Prisma,
  type ReservationStatus,
} from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  CancelReservationInput,
  CreateReservationInput,
} from './reservations.schema.js';
import { toImageUrl } from '../../utils/asset-url.js';

// 결제 1건·견적 1건당 예약은 1개 (payment_id, quote_id unique)
// 프론트는 details.reservationId로 기존 예약에 연결한다
function reservationAlreadyExists(reservationId: string) {
  return new HttpError(
    409,
    'RESERVATION_ALREADY_EXISTS',
    '이미 예약이 있어요.',
    { reservationId },
  );
}

const CANCELABLE_STATUSES: ReservationStatus[] = [
  'CONFIRMED',
  'SHOOT_COMPLETED',
];

const DELIVERY_DUE_DAYS = 14;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDeliveryDueDate(shootAt: Date): string {
  const due = new Date(
    shootAt.getTime() + KST_OFFSET_MS + DELIVERY_DUE_DAYS * DAY_MS,
  );
  return due.toISOString().slice(0, 10);
}

// POST /me/reservations
export async function createReservation(
  userId: string,
  input: CreateReservationInput,
) {
  const payment = await prisma.payments.findUnique({
    where: { id: input.paymentId },
    select: {
      user_id: true,
      status: true,
      pg_provider: true,
      photographer: { select: { id: true, nickname: true } },
      reservation: { select: { id: true } },
      quote: {
        select: {
          id: true,
          product_name: true,
          shoot_at: true,
          location: true,
          price: true,
          reservation: { select: { id: true } },
        },
      },
    },
  });

  if (!payment || payment.user_id !== userId) {
    throw new HttpError(
      404,
      'PAYMENT_NOT_FOUND',
      '결제 내역을 찾을 수 없어요.',
    );
  }

  const existingId = payment.reservation?.id ?? payment.quote?.reservation?.id;
  if (existingId) {
    throw reservationAlreadyExists(existingId);
  }

  if (payment.status !== 'SUCCEEDED') {
    throw new HttpError(
      409,
      'PAYMENT_NOT_SUCCEEDED',
      '결제가 완료된 건만 예약할 수 있어요.',
    );
  }

  if (!payment.quote) {
    throw new HttpError(
      409,
      'QUOTE_UNAVAILABLE',
      '결제에 연결된 견적을 찾을 수 없어요.',
    );
  }

  if (!payment.photographer) {
    throw new HttpError(
      409,
      'PHOTOGRAPHER_UNAVAILABLE',
      '탈퇴한 작가의 결제 건은 예약할 수 없어요.',
    );
  }

  try {
    const reservation = await prisma.reservations.create({
      data: {
        payment_id: input.paymentId,
        quote_id: payment.quote.id,
        user_id: userId,
        photographer_id: payment.photographer.id,
        status: 'CONFIRMED',
        shoot_at: payment.quote.shoot_at,
        location: payment.quote.location,
        total_amount: payment.quote.price,
      },
      select: {
        id: true,
        shoot_at: true,
        location: true,
        total_amount: true,
      },
    });

    return {
      reservationId: reservation.id,
      photographerNickname: payment.photographer.nickname,
      productName: payment.quote.product_name,
      shootAt: reservation.shoot_at,
      location: reservation.location,
      totalAmount: reservation.total_amount,
      paymentProvider: payment.pg_provider,
    };
  } catch (error) {
    // 동시 요청으로 위 확인을 통과한 뒤 다른 요청이 먼저 생성한 경우
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.reservations.findFirst({
        where: {
          OR: [{ payment_id: input.paymentId }, { quote_id: payment.quote.id }],
        },
        select: { id: true },
      });
      if (existing) {
        throw reservationAlreadyExists(existing.id);
      }
    }
    throw error;
  }
}

// GET /me/reservations/:reservationId
export async function getReservationDetail(
  viewer: { userId: string | null; photographerId: string | null },
  accountId: string,
  reservationId: string,
) {
  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      user_id: true,
      photographer_id: true,
      status: true,
      shoot_at: true,
      location: true,
      total_amount: true,
      created_at: true,
      quote: { select: { duration_minutes: true, photo_count: true } },
      user: { select: { id: true, nickname: true, profile_image_url: true } },
      photographer: {
        select: { id: true, nickname: true, profile_image_url: true },
      },
      // 가장 최근 취소 요청 1건
      reservation_cancel_request: {
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          id: true,
          status: true,
          reason: true,
          requested_by_account_id: true,
          created_at: true,
          processed_at: true,
        },
      },
    },
  });

  const isParticipant =
    !!reservation &&
    ((viewer.userId !== null && reservation.user_id === viewer.userId) ||
      (viewer.photographerId !== null &&
        reservation.photographer_id === viewer.photographerId));

  if (!reservation || !isParticipant) {
    throw new HttpError(404, 'RESERVATION_NOT_FOUND', '예약을 찾을 수 없어요.');
  }

  const latest = reservation.reservation_cancel_request[0] ?? null;

  const base = {
    reservationId: reservation.id,
    status: reservation.status,
    shootAt: reservation.shoot_at,
    location: reservation.location,
    durationMinutes: reservation.quote?.duration_minutes ?? null,
    photoCount: reservation.quote?.photo_count ?? null,
    deliveryDueDate: toDeliveryDueDate(reservation.shoot_at),
    totalAmount: reservation.total_amount,
    createdAt: reservation.created_at,
  };

  const cancel = {
    cancelRequest: latest && {
      cancelRequestId: latest.id,
      status: latest.status,
      reason: latest.reason,
      requestedByMe: latest.requested_by_account_id === accountId,
      requestedAt: latest.created_at,
      processedAt: latest.processed_at,
    },
    canRequestCancel:
      (reservation.status === 'CONFIRMED' ||
        reservation.status === 'SHOOT_COMPLETED') &&
      latest?.status !== 'PENDING',
  };

  // 조회한 계정에 따라 상대방 정보만 내려준다
  if (viewer.userId) {
    const { photographer } = reservation;
    return {
      ...base,
      photographer: photographer && {
        photographerId: photographer.id,
        nickname: photographer.nickname,
        profileImageUrl: toImageUrl(photographer.profile_image_url),
      },
      ...cancel,
    };
  }

  const { user } = reservation;
  return {
    ...base,
    user: user && {
      userId: user.id,
      nickname: user.nickname,
      profileImageUrl: toImageUrl(user.profile_image_url),
    },
    ...cancel,
  };
}

// POST /me/reservations/:reservationId
export async function createcancelReservation(
  requester: {
    accountId: string;
    userId: string | null;
    photographerId: string | null;
  },
  reservationId: string,
  input: CancelReservationInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE`;

    const reservation = await tx.reservations.findUnique({
      where: { id: reservationId },
      select: {
        user_id: true,
        photographer_id: true,
        status: true,
        reservation_cancel_request: {
          where: { status: 'PENDING' },
          take: 1,
          select: { id: true },
        },
      },
    });

    const isParticipant =
      !!reservation &&
      ((requester.userId !== null &&
        reservation.user_id === requester.userId) ||
        (requester.photographerId !== null &&
          reservation.photographer_id === requester.photographerId));

    if (!isParticipant) {
      throw new HttpError(
        404,
        'RESERVATION_NOT_FOUND',
        '예약을 찾을 수 없어요.',
      );
    }

    if (!CANCELABLE_STATUSES.includes(reservation.status)) {
      throw new HttpError(
        409,
        'RESERVATION_NOT_CANCELABLE',
        '해당 예약은 취소가 불가능해요.',
      );
    }

    const pending = reservation.reservation_cancel_request[0];
    if (pending) {
      throw new HttpError(
        409,
        'CANCEL_REQUEST_ALREADY_PENDING',
        '이미 처리 대기 중인 취소 요청이 있어요.',
        { cancelRequestId: pending.id },
      );
    }

    const cancelRequest = await tx.reservation_cancel_requests.create({
      data: {
        reservation_id: reservationId,
        requested_by_account_id: requester.accountId,
        reason: input.reason,
        status: 'PENDING',
      },
      select: { id: true, status: true, reason: true, created_at: true },
    });

    return {
      cancelRequestId: cancelRequest.id,
      status: cancelRequest.status,
      reason: cancelRequest.reason,
      requestedAt: cancelRequest.created_at,
    };
  });
}
