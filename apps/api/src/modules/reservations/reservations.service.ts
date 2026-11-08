import { prisma } from '../../lib/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateReservationInput } from './reservations.schema.js';

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

// POST /me/reservations
export async function createReservation(
  userId: string,
  input: CreateReservationInput,
) {
  const payment = await prisma.payments.findUnique({
    where: { id: input.paymentId },
    select: {
      user_id: true,
      photographer_id: true,
      status: true,
      reservation: { select: { id: true } },
      quote: {
        select: {
          id: true,
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

  if (!payment.photographer_id) {
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
        photographer_id: payment.photographer_id,
        status: 'CONFIRMED',
        shoot_at: payment.quote.shoot_at,
        location: payment.quote.location,
        total_amount: payment.quote.price,
      },
      select: {
        id: true,
        payment_id: true,
        quote_id: true,
        photographer_id: true,
        status: true,
        shoot_at: true,
        location: true,
        total_amount: true,
        created_at: true,
      },
    });

    return {
      reservationId: reservation.id,
      paymentId: reservation.payment_id,
      quoteId: reservation.quote_id,
      photographerId: reservation.photographer_id,
      status: reservation.status,
      shootAt: reservation.shoot_at,
      location: reservation.location,
      totalAmount: reservation.total_amount,
      createdAt: reservation.created_at,
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
