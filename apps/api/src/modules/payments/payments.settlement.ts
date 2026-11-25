import { prisma } from '../../lib/prisma.js';
import type { notifications } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import {
  createReservation,
  toReservationNumber,
} from '../reservations/reservations.service.js';
import {
  approveTossPayment,
  cancelTossPayment,
  lookupTossPayment,
  type TossPayment,
  type TossTarget,
} from './payments.toss.js';

// 방금 시작된 결제는 승인 요청이 처리 중일 수 있어 주기 실행에서 건너뛴다
export const PENDING_STALE_MS = 60 * 1000;
// 토스 결제 인증의 유효 시간. 지나도 승인되지 않은 결제는 실패로 확정한다
const APPROVAL_VALID_MS = 10 * 60 * 1000;

// 다시 시도해도 예약을 만들 수 없는 오류
const PERMANENT_RESERVATION_ERROR_CODES = new Set([
  'PHOTOGRAPHER_UNAVAILABLE',
  'QUOTE_UNAVAILABLE',
]);

export type PendingPayment = {
  id: string;
  userId: string | null;
  target: TossTarget;
};

type SettledPayment =
  | {
      status: 'SUCCEEDED';
      reservationId: string;
      reservationNumber: string;
      chatRoomId: string | null;
      notifications: notifications[];
    }
  | { status: 'FAILED' }
  | { status: 'CANCELED' }
  | { status: 'PENDING' };

const paymentStateChanged = () =>
  new HttpError(
    409,
    'PAYMENT_STATE_CHANGED',
    '결제 상태가 변경되었습니다. 다시 확인해 주세요.',
  );

// 처리 중인 결제만 바꿔, 이미 끝난 결제를 덮어쓰지 않는다
async function closePendingPayment(
  payment: PendingPayment,
  status: 'FAILED' | 'CANCELED',
) {
  const closed = await prisma.payments.updateMany({
    where: {
      id: payment.id,
      status: 'PENDING',
      pg_payment_id: payment.target.paymentKey,
    },
    data: { status },
  });

  if (closed.count === 0) {
    throw paymentStateChanged();
  }
}

export function failPendingPayment(payment: PendingPayment) {
  return closePendingPayment(payment, 'FAILED');
}

// 토스 취소를 먼저 확인한 뒤 DB를 바꾼다
// 토스 취소에 실패하면 PENDING을 유지해 다음에 다시 취소한다
async function cancelApprovedPayment(payment: PendingPayment) {
  await cancelTossPayment(payment.target, '예약 생성 불가');
  await closePendingPayment(payment, 'CANCELED');
}

async function completePayment(
  payment: PendingPayment,
  userId: string,
): Promise<SettledPayment> {
  return prisma.$transaction(async (tx) => {
    const completed = await tx.payments.updateMany({
      where: {
        id: payment.id,
        status: 'PENDING',
        pg_payment_id: payment.target.paymentKey,
      },
      data: {
        status: 'SUCCEEDED',
        paid_at: new Date(),
      },
    });

    if (completed.count === 0) {
      // 다른 요청이나 정리 작업이 먼저 완료한 경우
      const latestPayment = await tx.payments.findUnique({
        where: { id: payment.id },
        select: {
          status: true,
          pg_payment_id: true,
          reservation: { select: { id: true, created_at: true } },
        },
      });

      if (
        latestPayment?.status === 'SUCCEEDED' &&
        latestPayment.pg_payment_id === payment.target.paymentKey &&
        latestPayment.reservation
      ) {
        return {
          status: 'SUCCEEDED',
          reservationId: latestPayment.reservation.id,
          reservationNumber: toReservationNumber(
            latestPayment.reservation.id,
            latestPayment.reservation.created_at,
          ),
          chatRoomId: null,
          notifications: [],
        };
      }

      throw paymentStateChanged();
    }

    const reservation = await createReservation(
      userId,
      { paymentId: payment.id },
      tx,
    );

    return {
      status: 'SUCCEEDED',
      reservationId: reservation.reservationId,
      reservationNumber: reservation.reservationNumber,
      chatRoomId: reservation.chatRoomId,
      notifications: reservation.notifications,
    };
  });
}

/**
 * 토스 결제 상태에 맞춰 PENDING 결제를 정리한다 (승인 요청과 정리 작업이 함께 사용)
 * 토스에서 아직 끝나지 않은 결제는 바꾸지 않고 PENDING을 반환한다
 */
export async function settlePayment(
  payment: PendingPayment,
  tossPayment: TossPayment,
): Promise<SettledPayment> {
  switch (tossPayment.status) {
    case 'ABORTED':
    case 'EXPIRED':
      await failPendingPayment(payment);
      return { status: 'FAILED' };
    case 'CANCELED':
      // 토스 취소 후 DB 수정만 실패했던 결제를 맞춘다
      await closePendingPayment(payment, 'CANCELED');
      return { status: 'CANCELED' };
    case 'DONE':
      break;
    default:
      return { status: 'PENDING' };
  }

  // 탈퇴한 사용자의 결제는 예약을 만들 수 없다
  if (!payment.userId) {
    await cancelApprovedPayment(payment);
    return { status: 'CANCELED' };
  }

  try {
    return await completePayment(payment, payment.userId);
  } catch (error) {
    if (
      !(error instanceof HttpError) ||
      !PERMANENT_RESERVATION_ERROR_CODES.has(error.code)
    ) {
      // 일시적 오류는 PENDING을 유지해 추가 결제 없이 다시 예약을 만들 수 있게 한다
      throw error;
    }

    // 예약 생성 트랜잭션은 롤백됐으므로 결제를 취소한다
    await cancelApprovedPayment(payment);
    return { status: 'CANCELED' };
  }
}

/**
 * PENDING 결제를 토스 상태에 맞춘다 (server.ts에서 시작할 때와 주기적으로 실행)
 * - 시간과 관계없이 토스를 먼저 조회하고, 조회에 실패하면 바꾸지 않는다
 * - 승인 전에 멈춘 결제는 인증이 유효한 동안 같은 멱등키로 승인을 다시 요청한다
 * - PENDING 시작 시각은 updated_at으로 본다 (created_at은 READY 생성 시각)
 * - 한 건이 실패해도 나머지는 계속 처리하고, 실패한 건은 다음 실행에 다시 시도한다
 */
export async function reconcilePendingPayments(now: Date, minAgeMs: number) {
  const stalePayments = await prisma.payments.findMany({
    where: {
      status: 'PENDING',
      pg_payment_id: { not: null },
      updated_at: { lte: new Date(now.getTime() - minAgeMs) },
    },
    orderBy: { updated_at: 'asc' },
    select: {
      id: true,
      user_id: true,
      amount: true,
      pg_order_id: true,
      pg_payment_id: true,
      updated_at: true,
      quote: { select: { chat_room_id: true, shoot_at: true } },
    },
  });

  const counts = { succeeded: 0, failed: 0, canceled: 0 };
  // 호출한 쪽에서 실시간 전송에 쓴다
  const events: {
    chatRoomId: string | null;
    notifications: notifications[];
  }[] = [];

  for (const row of stalePayments) {
    if (!row.pg_payment_id) continue;

    const payment: PendingPayment = {
      id: row.id,
      userId: row.user_id,
      target: {
        paymentKey: row.pg_payment_id,
        orderId: row.pg_order_id,
        amount: row.amount,
      },
    };

    try {
      const lookup = await lookupTossPayment(payment.target);

      if (lookup.type === 'UNKNOWN') continue;

      let tossPayment = lookup.type === 'FOUND' ? lookup.payment : undefined;
      let failed = false;

      if (!tossPayment || tossPayment.status === 'IN_PROGRESS') {
        if (now.getTime() - row.updated_at.getTime() >= APPROVAL_VALID_MS) {
          failed = true;
        } else if (row.user_id && row.quote && row.quote.shoot_at > now) {
          const approval = await approveTossPayment(payment.target, payment.id);
          failed = approval.rejected;
          tossPayment = approval.payment;
        }
      }

      let settled: SettledPayment;
      if (failed) {
        await failPendingPayment(payment);
        settled = { status: 'FAILED' };
      } else if (tossPayment) {
        settled = await settlePayment(payment, tossPayment);
      } else {
        continue;
      }

      if (settled.status === 'PENDING') continue;
      if (settled.status === 'SUCCEEDED') counts.succeeded += 1;
      if (settled.status === 'FAILED') counts.failed += 1;
      if (settled.status === 'CANCELED') counts.canceled += 1;

      // 실패·취소여도 열려 있는 채팅의 결제 버튼이 갱신되도록 신호를 보낸다
      events.push({
        chatRoomId: row.quote?.chat_room_id ?? null,
        notifications:
          settled.status === 'SUCCEEDED' ? settled.notifications : [],
      });
    } catch (error) {
      console.error(`[reconcile-payment] ${row.id} failed`, error);
    }
  }

  return { counts, events };
}
