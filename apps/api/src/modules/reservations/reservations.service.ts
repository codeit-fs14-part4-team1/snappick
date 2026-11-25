import { prisma } from '../../lib/prisma.js';
import { Prisma, ReservationStatus } from '../../generated/prisma/client.js';
import type {
  chat_messages,
  notifications,
} from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  CancelReservationInput,
  CreateDeliverableInput,
  CreateReservationInput,
  GetReservationInput,
  PatchCancelReservationInput,
  PatchDeliverableInput,
} from './reservations.schema.js';
import { toImageUrl } from '../../utils/asset-url.js';
import {
  cancelShootReminders,
  createNotification,
  notificationMessages,
  scheduleShootReminders,
} from '../notifications/notifications.create.js';
import { createUserActionLog } from '../interactions/interactions.service.js';

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

const GET_RESERVATION_ENUM: Record<
  GetReservationInput['type'],
  ReservationStatus[] | null
> = {
  ALL: null,
  UPCOMING: ['CONFIRMED'],
  IN_PROGRESS: ['SHOOT_COMPLETED', 'DELIVERED'],
  COMPLETED: ['PURCHASE_CONFIRMED'],
  CANCELED: ['CANCELED'],
};

const DELIVERY_DUE_DAYS = 14;
// 결과물 전달(DELIVERED) 후 구매 확정까지
const PURCHASE_CONFIRM_DAYS = 8;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDeliveryDueDate(shootAt: Date): string {
  const due = new Date(
    shootAt.getTime() + KST_OFFSET_MS + DELIVERY_DUE_DAYS * DAY_MS,
  );
  return due.toISOString().slice(0, 10);
}

/**
 * 화면에 표시하는 예약번호: SP-YYMMDD-HHMMSS-XXXX (예약 생성 시각, 한국 시간)
 * XXXX는 UUID 끝 5자리(20비트)를 32진수 4자리로 바꾼 값
 * 저장하지 않는 표시용 값이라 중복을 보장하지 않으므로 예약을 찾을 때는 reservationId를 쓴다
 */
export function toReservationNumber(
  reservationId: string,
  createdAt: Date,
): string {
  const [date, time] = new Date(createdAt.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(2, 19)
    .replace(/[-:]/g, '')
    .split('T');
  const code = Number.parseInt(reservationId.slice(-5), 16)
    .toString(32)
    .toUpperCase()
    .padStart(4, '0');
  return `SP-${date}-${time}-${code}`;
}

// 기준 시각이 속한 날의 00시 (한국 시간)
function kstDayStart(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
      KST_OFFSET_MS,
  );
}

/**
 * 시간 경과에 따른 예약 상태 자동 전환 (server.ts에서 주기적으로 실행)
 * - CONFIRMED → SHOOT_COMPLETED: 촬영일 다음 날 00시(한국 시간)가 되면
 * - DELIVERED → PURCHASE_CONFIRMED: 전달 후 8일이 지나면
 *   DELIVERED는 작가가 결과물을 전달할 때만 바뀐다 (시간 경과로 자동 전환하지 않는다)
 *   전달 시각은 deliverable.created_at(최초 전달 시각)으로 판단한다
 *   예약이나 결과물을 수정해도 바뀌지 않으므로 구매 확정이 밀리지 않는다
 *
 * 조건에 맞는 행을 한 번에 바꾸므로 여러 번 실행해도 결과가 같고, 밀린 건도 다음 실행에 처리된다
 * now를 인자로 받는 이유: 시각을 정해 두고 테스트할 수 있게
 */
export async function advanceReservationStatuses(now: Date) {
  const shootCompleted = await prisma.reservations.updateMany({
    where: { status: 'CONFIRMED', shoot_at: { lt: kstDayStart(now) } },
    data: { status: 'SHOOT_COMPLETED' },
  });

  const purchaseConfirmed = await prisma.reservations.updateMany({
    where: {
      status: 'DELIVERED',
      deliverable: {
        created_at: {
          lte: new Date(now.getTime() - PURCHASE_CONFIRM_DAYS * DAY_MS),
        },
      },
    },
    data: { status: 'PURCHASE_CONFIRMED', purchase_confirmed_at: now },
  });

  return {
    shootCompleted: shootCompleted.count,
    purchaseConfirmed: purchaseConfirmed.count,
  };
}

// POST /me/reservations
export async function createReservation(
  userId: string,
  input: CreateReservationInput,
  db?: Prisma.TransactionClient,
) {
  const client = db ?? prisma;
  const payment = await client.payments.findUnique({
    where: { id: input.paymentId },
    select: {
      user_id: true,
      status: true,
      pg_provider: true,
      paid_at: true,
      user: { select: { auth_account_id: true } },
      photographer: {
        select: {
          id: true,
          auth_account: { select: { nickname: true } },
          auth_account_id: true,
        },
      },
      reservation: { select: { id: true } },
      quote: {
        select: {
          id: true,
          quote_name: true,
          chat_room_id: true,
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

  const { quote, photographer } = payment;
  // 예약 확정·촬영일 알림을 받을 유저와 작가의 계정
  const accountIds = [
    payment.user?.auth_account_id,
    photographer.auth_account_id,
  ].filter((id): id is string => !!id);

  try {
    // 예약이 생성될 때만 알림이 남도록 같은 트랜잭션에서 저장한다
    const createReservationRecords = async (tx: Prisma.TransactionClient) => {
      const created = await tx.reservations.create({
        data: {
          payment_id: input.paymentId,
          quote_id: quote.id,
          user_id: userId,
          photographer_id: photographer.id,
          status: 'CONFIRMED',
          shoot_at: quote.shoot_at,
          location: quote.location,
          total_amount: quote.price,
        },
        select: {
          id: true,
          shoot_at: true,
          location: true,
          total_amount: true,
          created_at: true,
        },
      });

      await createUserActionLog(
        { userId, type: 'RESERVE', photographerId: photographer.id },
        tx,
      );

      const notifications: notifications[] = [];
      for (const accountId of accountIds) {
        notifications.push(
          await createNotification(
            {
              accountId,
              type: 'RESERVATION_CONFIRMED',
              targetId: created.id,
              message: notificationMessages.reservationConfirmed(),
            },
            tx,
          ),
        );
      }

      await scheduleShootReminders(
        {
          reservationId: created.id,
          shootAt: created.shoot_at,
          accountIds,
        },
        tx,
      );

      if (quote.chat_room_id) {
        const message = await tx.chat_messages.create({
          data: {
            chat_room_id: quote.chat_room_id,
            recipient_account_id: photographer.auth_account_id,
            message_type: 'SYSTEM',
            content: '예약이 확정됐어요',
            payload: { type: 'RESERVATION_CONFIRMED' },
            reservation_id: created.id,
            quote_id: quote.id,
            created_at: payment.paid_at ?? created.created_at,
          },
        });
        await tx.chat_rooms.updateMany({
          where: {
            id: quote.chat_room_id,
            last_message_at: { lt: message.created_at },
          },
          data: { last_message_at: message.created_at },
        });
      }

      return { reservation: created, notifications };
    };

    const { reservation, notifications } = db
      ? await createReservationRecords(db)
      : await prisma.$transaction(createReservationRecords);

    return {
      reservationId: reservation.id,
      reservationNumber: toReservationNumber(
        reservation.id,
        reservation.created_at,
      ),
      chatRoomId: quote.chat_room_id,
      photographerNickname: photographer.auth_account.nickname,
      productName: quote.quote_name,
      shootAt: reservation.shoot_at,
      location: reservation.location,
      totalAmount: reservation.total_amount,
      paymentProvider: payment.pg_provider,
      // 컨트롤러가 실시간 전송에 쓰고 응답에서는 뺀다
      notifications,
    };
  } catch (error) {
    if (db) {
      throw error;
    }

    // 동시 요청으로 위 확인을 통과한 뒤 다른 요청이 먼저 생성한 경우
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.reservations.findFirst({
        where: {
          OR: [{ payment_id: input.paymentId }, { quote_id: quote.id }],
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
      purchase_confirmed_at: true,
      deliverable: { select: { created_at: true } },
      quote: {
        select: {
          quote_name: true,
          includes_original: true,
          additional_notice: true,
          common_notice: true,
          chat_room_id: true,
          duration_minutes: true,
          photo_count: true,
          location_lat: true,
          location_lng: true,
        },
      },
      user: {
        select: {
          id: true,
          auth_account: { select: { nickname: true } },
          profile_image_url: true,
        },
      },
      photographer: {
        select: {
          id: true,
          auth_account: { select: { nickname: true } },
          profile_image_url: true,
        },
      },
      // 가장 최근 취소 요청 1건
      reservation_cancel_request: {
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          id: true,
          status: true,
          reason: true,
          accept_reason: true,
          requested_by_account_id: true,
          auth_account: { select: { account_type: true } },
          created_at: true,
          processed_at: true,
        },
      },
      payment: {
        select: {
          id: true,
          payment_method: true,
          pg_provider: true,
          paid_at: true,
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
  // 유저가 요청한 취소인지, 작가가 직접 취소한 것인지에 따라 reason의 작성자가 다르다
  const canceledByUser = latest?.auth_account.account_type === 'USER';

  const base = {
    reservationId: reservation.id,
    reservationNumber: toReservationNumber(
      reservation.id,
      reservation.created_at,
    ),
    quote: reservation.quote
      ? {
          name: reservation.quote?.quote_name,
          includesOriginal: reservation.quote?.includes_original,
          additionalNotice: reservation.quote?.additional_notice,
          commonNotice: reservation.quote?.common_notice,
          chatRoomId: reservation.quote?.chat_room_id,
        }
      : null,
    status: reservation.status,
    shootAt: reservation.shoot_at,
    location: reservation.location,
    // 촬영 장소 지도 표시용 좌표 (견적 연결이 끊긴 예약은 null)
    locationCoords: reservation.quote
      ? {
          lat: reservation.quote.location_lat,
          lng: reservation.quote.location_lng,
        }
      : null,
    durationMinutes: reservation.quote?.duration_minutes ?? null,
    photoCount: reservation.quote?.photo_count ?? null,
    deliveryDueDate: toDeliveryDueDate(reservation.shoot_at),
    totalAmount: reservation.total_amount,
    payment: reservation.payment
      ? {
          paymentMethod: reservation.payment.payment_method,
          paymentProvider: reservation.payment.pg_provider,
          paidAt: reservation.payment.paid_at,
        }
      : null,
    createdAt: reservation.created_at,
    // 결과물 최초 전달 시각 (결과물을 수정해도 바뀌지 않는다)
    deliveredAt: reservation.deliverable?.created_at ?? null,
    purchaseConfirmedAt: reservation.purchase_confirmed_at,
  };

  const cancel = {
    cancelRequest: latest && {
      cancelRequestId: latest.id,
      status: latest.status,
      userReason: canceledByUser ? latest.reason : null,
      photographerReason: canceledByUser ? latest.accept_reason : latest.reason,
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
        nickname: photographer.auth_account.nickname,
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
      nickname: user.auth_account.nickname,
      profileImageUrl: toImageUrl(user.profile_image_url),
    },
    ...cancel,
  };
}

// POST /me/reservations/:reservationId/cancel
export async function createCancelReservation(
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
        user: {
          select: {
            auth_account_id: true,
            auth_account: { select: { nickname: true } },
          },
        },
        status: true,
        // 예약에 연결된 견적에서 채팅방 ID를 가져옴
        quote: {
          select: {
            chat_room_id: true,
          },
        },
        // 취소 요청을 받을 작가의 계정 ID를 가져옴
        photographer: {
          select: {
            auth_account_id: true,
          },
        },
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

    const isPhotographer =
      requester.photographerId !== null && requester.userId === null;

    const cancelRequest = await tx.reservation_cancel_requests.create({
      data: {
        reservation_id: reservationId,
        requested_by_account_id: requester.accountId,
        reason: input.reason,
        status: isPhotographer ? 'ACCEPTED' : 'PENDING',
        processed_at: isPhotographer ? new Date() : null,
      },
      select: {
        id: true,
        status: true,
        reason: true,
        created_at: true,
        processed_at: true,
      },
    });

    // 컨트롤러가 실시간 전송에 쓰고 응답에서는 뺀다
    const notifications: notifications[] = [];

    if (cancelRequest.status === 'ACCEPTED') {
      await tx.reservations.update({
        where: { id: reservationId },
        data: {
          status: 'CANCELED',
        },
      });
      // 취소된 예약의 촬영일 알림이 가지 않도록 지운다
      await cancelShootReminders(reservationId, tx);

      // 예약 취소를 유저와 작가에게 알린다 (탈퇴한 쪽은 제외)
      const accountIds = [
        reservation.user?.auth_account_id,
        reservation.photographer?.auth_account_id,
      ].filter((id): id is string => !!id);

      for (const accountId of accountIds) {
        notifications.push(
          await createNotification(
            {
              accountId,
              type: 'RESERVATION_CANCELED',
              targetId: reservationId,
              message: notificationMessages.reservationCanceled(),
            },
            tx,
          ),
        );
      }
    } else if (reservation.photographer) {
      notifications.push(
        await createNotification(
          {
            accountId: reservation.photographer.auth_account_id,
            type: 'CANCEL_REQUESTED',
            targetId: reservationId,
            message: notificationMessages.cancelRequested(
              reservation.user?.auth_account.nickname ?? '사용자',
            ),
          },
          tx,
        ),
      );
    }

    let systemMessage: chat_messages | null = null;

    const chatRoomId = reservation.quote?.chat_room_id;

    // 취소한 사람의 상대방을 수신자로 지정
    const recipientAccountId = isPhotographer
      ? reservation.user?.auth_account_id
      : reservation.photographer?.auth_account_id;

    // 취소한 사람에 따라 메시지 내용을 구분
    const content = isPhotographer
      ? '작가가 예약을 취소했습니다.'
      : '사용자가 예약 취소를 요청했습니다.';

    if (chatRoomId) {
      systemMessage = await tx.chat_messages.create({
        data: {
          chat_room_id: chatRoomId,
          recipient_account_id: recipientAccountId ?? null,
          reservation_id: reservationId,
          message_type: 'SYSTEM',
          content,
          payload: {
            type: isPhotographer
              ? 'RESERVATION_CANCELED'
              : 'RESERVATION_CANCEL_REQUESTED',
          },
        },
      });

      await tx.chat_rooms.updateMany({
        where: {
          id: chatRoomId,
          last_message_at: {
            lt: systemMessage.created_at,
          },
        },
        data: {
          last_message_at: systemMessage.created_at,
        },
      });
    }

    return {
      cancelRequestId: cancelRequest.id,
      status: cancelRequest.status,
      reason: cancelRequest.reason,
      requestedAt: cancelRequest.created_at,
      processedAt: cancelRequest.processed_at,
      systemMessage,
      notifications,
    };
  });
}

// PATCH /me/reservations/:reservationId/cancel/:cancelRequestId
export async function patchCancelReservation(
  photographerId: string,
  reservationId: string,
  cancelRequestId: string,
  input: PatchCancelReservationInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE`;

    const reservation = await tx.reservations.findUnique({
      where: { id: reservationId },
      select: {
        photographer_id: true,
        status: true,
        quote: {
          select: {
            chat_room_id: true,
          },
        },
        user: {
          select: {
            auth_account_id: true,
          },
        },
        // 예약 취소를 알릴 작가의 계정 ID를 가져옴
        photographer: {
          select: {
            auth_account_id: true,
          },
        },
        reservation_cancel_request: {
          where: { id: cancelRequestId },
          select: { id: true, status: true },
        },
      },
    });

    if (!reservation || reservation.photographer_id !== photographerId) {
      throw new HttpError(
        404,
        'RESERVATION_NOT_FOUND',
        '예약을 찾을 수 없어요.',
      );
    }

    const cancelRequest = reservation.reservation_cancel_request[0];
    if (!cancelRequest) {
      throw new HttpError(
        404,
        'CANCEL_REQUEST_NOT_FOUND',
        '취소 요청을 찾을 수 없어요.',
      );
    }

    if (cancelRequest.status !== 'PENDING') {
      throw new HttpError(
        409,
        'CANCEL_REQUEST_ALREADY_PROCESSED',
        '이미 처리된 취소 요청이에요.',
        { status: cancelRequest.status },
      );
    }

    const accepted = input.status === 'ACCEPTED';
    if (accepted && !CANCELABLE_STATUSES.includes(reservation.status)) {
      throw new HttpError(
        409,
        'RESERVATION_NOT_CANCELABLE',
        '해당 예약은 취소가 불가능해요.',
      );
    }

    const processed = await tx.reservation_cancel_requests.update({
      where: { id: cancelRequest.id },
      data: {
        status: input.status,
        accept_reason: input.status === 'ACCEPTED' ? input.reason : null,
        processed_at: new Date(),
      },
      select: {
        id: true,
        status: true,
        reason: true,
        accept_reason: true,
        processed_at: true,
      },
    });

    const updatedReservation = accepted
      ? await tx.reservations.update({
          where: { id: reservationId },
          data: { status: 'CANCELED' },
          select: { status: true },
        })
      : { status: reservation.status };

    // 컨트롤러가 실시간 전송에 쓰고 응답에서는 뺀다
    const notifications: notifications[] = [];

    if (accepted) {
      // 취소된 예약의 촬영일 알림이 가지 않도록 지운다
      await cancelShootReminders(reservationId, tx);

      // 예약 취소를 유저와 작가에게 알린다 (탈퇴한 쪽은 제외)
      const accountIds = [
        reservation.user?.auth_account_id,
        reservation.photographer?.auth_account_id,
      ].filter((id): id is string => !!id);

      for (const accountId of accountIds) {
        notifications.push(
          await createNotification(
            {
              accountId,
              type: 'RESERVATION_CANCELED',
              targetId: reservationId,
              message: notificationMessages.reservationCanceled(),
            },
            tx,
          ),
        );
      }
    } else if (reservation.user) {
      notifications.push(
        await createNotification(
          {
            accountId: reservation.user.auth_account_id,
            type: 'CANCEL_REJECTED',
            targetId: reservationId,
            message: notificationMessages.cancelRejected(),
          },
          tx,
        ),
      );
    }

    let systemMessage: chat_messages | null = null;

    const chatRoomId = reservation.quote?.chat_room_id;
    const recipientAccountId = reservation.user?.auth_account_id;

    const content = accepted
      ? '작가가 예약 취소 요청을 수락했습니다.'
      : '작가가 예약 취소 요청을 반려했습니다.';

    if (chatRoomId) {
      systemMessage = await tx.chat_messages.create({
        data: {
          chat_room_id: chatRoomId,
          recipient_account_id: recipientAccountId ?? null,
          reservation_id: reservationId,
          message_type: 'SYSTEM',
          content,
          payload: {
            type: accepted
              ? 'RESERVATION_CANCELED'
              : 'RESERVATION_CANCEL_REJECTED',
          },
        },
      });

      await tx.chat_rooms.updateMany({
        where: {
          id: chatRoomId,
          last_message_at: {
            lt: systemMessage.created_at,
          },
        },
        data: {
          last_message_at: systemMessage.created_at,
        },
      });
    }

    return {
      cancelRequestId: processed.id,
      status: processed.status,
      userReason: processed.reason,
      photographerReason: processed.accept_reason,
      processedAt: processed.processed_at,
      reservationStatus: updatedReservation.status,
      systemMessage,
      notifications,
    };
  });
}

// GET /me/reservations?tyep=&page=n&pageSize=n
export async function getReservation(
  viewer: {
    userId: string | null;
    photographerId: string | null;
  },
  query: GetReservationInput,
) {
  const statuses = GET_RESERVATION_ENUM[query.type];
  const where = {
    ...(viewer.userId
      ? { user_id: viewer.userId }
      : { photographer_id: viewer.photographerId }),
    ...(statuses && { status: { in: statuses } }),
  };
  const [totalCount, rows] = await Promise.all([
    prisma.reservations.count({ where }),
    prisma.reservations.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        quote: {
          select: {
            quote_name: true,
          },
        },
        user: {
          select: {
            auth_account: { select: { nickname: true } },
            profile_image_url: true,
          },
        },
        photographer: {
          select: {
            auth_account: { select: { nickname: true } },
            profile_image_url: true,
          },
        },
        status: true,
        shoot_at: true,
        location: true,
        total_amount: true,
        created_at: true,
        reservation_cancel_request: {
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            status: true,
          },
        },
      },
    }),
  ]);

  return {
    items: rows.map((reservation) => {
      // 조회한 계정의 상대방: 유저가 보면 작가, 작가가 보면 유저
      const other = viewer.userId ? reservation.photographer : reservation.user;
      return {
        reservationId: reservation.id,
        name: reservation.quote?.quote_name ?? null,
        counterpart: other && {
          nickname: other.auth_account.nickname,
          profileImageUrl: toImageUrl(other.profile_image_url),
        },
        status: reservation.status,
        cancelRequestStatus:
          reservation.reservation_cancel_request[0]?.status ?? null,
        shootAt: reservation.shoot_at,
        location: reservation.location,
        totalAmount: reservation.total_amount,
        createdAt: reservation.created_at,
      };
    }),
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / query.pageSize),
  };
}

const reservationNotFound = () =>
  new HttpError(404, 'RESERVATION_NOT_FOUND', '예약을 찾을 수 없어요.');

const deliverableNotFound = () =>
  new HttpError(404, 'DELIVERABLE_NOT_FOUND', '결과물을 찾을 수 없어요.');

const DELIVERABLE_SELECT = {
  id: true,
  reservation_id: true,
  link: true,
  expiration_period: true,
  notice: true,
  created_at: true,
  updated_at: true,
} as const;

// 링크 유효 기간은 받을 때와 같은 YYYY.MM.DD(한국 날짜)로 내려준다
function toKstDotDate(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', '.');
}

function toDeliverableResponse(deliverable: {
  id: string;
  reservation_id: string;
  link: string;
  expiration_period: Date;
  notice: string | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    deliverableId: deliverable.id,
    reservationId: deliverable.reservation_id,
    link: deliverable.link,
    expirationPeriod: toKstDotDate(deliverable.expiration_period),
    notice: deliverable.notice,
    createdAt: deliverable.created_at,
    updatedAt: deliverable.updated_at,
  };
}

// GET /me/reservations/:reservationId/deliverable
// 예약의 유저·작가만 볼 수 있다
export async function getDeliverable(
  viewer: { userId: string | null; photographerId: string | null },
  reservationId: string,
) {
  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    select: {
      user_id: true,
      photographer_id: true,
      deliverable: { select: DELIVERABLE_SELECT },
    },
  });

  const isParticipant =
    !!reservation &&
    ((viewer.userId !== null && reservation.user_id === viewer.userId) ||
      (viewer.photographerId !== null &&
        reservation.photographer_id === viewer.photographerId));

  if (!reservation || !isParticipant) {
    throw reservationNotFound();
  }
  if (!reservation.deliverable) {
    throw deliverableNotFound();
  }

  return toDeliverableResponse(reservation.deliverable);
}

// POST /me/reservations/:reservationId/deliverable
// 작가가 결과물을 처음 등록하면 예약을 DELIVERED로 바꾸고 유저에게 알린다
export async function createDeliverable(
  photographerId: string,
  reservationId: string,
  input: CreateDeliverableInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE`;

    const reservation = await tx.reservations.findUnique({
      where: { id: reservationId },
      select: {
        photographer_id: true,
        status: true,
        user: { select: { auth_account_id: true } },
        photographer: {
          select: { auth_account: { select: { nickname: true } } },
        },
        quote: { select: { chat_room_id: true } },
        deliverable: { select: { id: true } },
        reservation_cancel_request: {
          where: { status: 'PENDING' },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!reservation || reservation.photographer_id !== photographerId) {
      throw reservationNotFound();
    }

    if (reservation.deliverable) {
      throw new HttpError(
        409,
        'DELIVERABLE_ALREADY_EXISTS',
        '이미 결과물을 등록했어요.',
        { deliverableId: reservation.deliverable.id },
      );
    }

    if (reservation.status !== 'SHOOT_COMPLETED') {
      throw new HttpError(
        409,
        'RESERVATION_NOT_DELIVERABLE',
        '촬영이 완료된 예약만 결과물을 등록할 수 있어요.',
      );
    }

    // DELIVERED는 취소할 수 없는 상태라, 대기 중인 취소 요청을 먼저 처리해야 한다
    const pending = reservation.reservation_cancel_request[0];
    if (pending) {
      throw new HttpError(
        409,
        'CANCEL_REQUEST_PENDING',
        '처리 대기 중인 취소 요청을 먼저 처리해 주세요.',
        { cancelRequestId: pending.id },
      );
    }

    const deliverable = await tx.deliverables.create({
      data: {
        reservation_id: reservationId,
        link: input.link,
        expiration_period: input.expirationPeriod,
        notice: input.notice ?? null,
      },
      select: DELIVERABLE_SELECT,
    });

    // 구매 확정 스케줄러는 위 결과물의 created_at을 전달 시각으로 본다
    await tx.reservations.update({
      where: { id: reservationId },
      data: { status: 'DELIVERED' },
    });

    const userAccountId = reservation.user?.auth_account_id;
    const notifications = userAccountId
      ? [
          await createNotification(
            {
              accountId: userAccountId,
              type: 'DELIVERY_COMPLETED',
              targetId: reservationId,
              message: notificationMessages.deliveryCompleted(
                reservation.photographer?.auth_account.nickname ?? '작가',
              ),
            },
            tx,
          ),
        ]
      : [];

    const chatRoomId = reservation.quote?.chat_room_id ?? null;
    if (chatRoomId) {
      const message = await tx.chat_messages.create({
        data: {
          chat_room_id: chatRoomId,
          recipient_account_id: userAccountId ?? null,
          reservation_id: reservationId,
          message_type: 'SYSTEM',
          content: '결과물이 전달됐어요',
          payload: { type: 'RESERVATION_DELIVERED' },
          created_at: deliverable.created_at,
        },
      });
      await tx.chat_rooms.updateMany({
        where: { id: chatRoomId, last_message_at: { lt: message.created_at } },
        data: { last_message_at: message.created_at },
      });
    }

    return {
      ...toDeliverableResponse(deliverable),
      reservationStatus: 'DELIVERED' as const,
      notifications,
      chatRoomId,
    };
  });
}

// PATCH /me/reservations/:reservationId/deliverable
// 결과물만 수정한다. 최초 전달 시각(created_at)은 바뀌지 않아 구매 확정이 밀리지 않는다
export async function patchDeliverable(
  photographerId: string,
  reservationId: string,
  input: PatchDeliverableInput,
) {
  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    select: {
      photographer_id: true,
      deliverable: { select: { id: true } },
    },
  });

  if (!reservation || reservation.photographer_id !== photographerId) {
    throw reservationNotFound();
  }
  if (!reservation.deliverable) {
    throw deliverableNotFound();
  }

  const deliverable = await prisma.deliverables.update({
    where: { id: reservation.deliverable.id },
    data: {
      ...(input.link !== undefined && { link: input.link }),
      ...(input.expirationPeriod !== undefined && {
        expiration_period: input.expirationPeriod,
      }),
      ...(input.notice !== undefined && { notice: input.notice }),
    },
    select: DELIVERABLE_SELECT,
  });

  return toDeliverableResponse(deliverable);
}

// PATCH /me/reservations/:reservationId/purchase-confirm
export async function confirmPurchase(userId: string, reservationId: string) {
  return prisma.$transaction(async (tx) => {
    // 중복 요청이나 자동 확정과 겹쳐도 한 번만 확정되도록 잠근다
    await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE`;

    const reservation = await tx.reservations.findUnique({
      where: { id: reservationId },
      select: { user_id: true, status: true },
    });

    if (!reservation || reservation.user_id !== userId) {
      throw reservationNotFound();
    }

    if (reservation.status === 'PURCHASE_CONFIRMED') {
      throw new HttpError(
        409,
        'ALREADY_PURCHASE_CONFIRMED',
        '이미 구매 확정한 예약이에요.',
      );
    }

    if (reservation.status !== 'DELIVERED') {
      throw new HttpError(
        409,
        'RESERVATION_NOT_CONFIRMABLE',
        '결과물을 받은 예약만 구매 확정할 수 있어요.',
      );
    }

    const confirmed = await tx.reservations.update({
      where: { id: reservationId },
      data: {
        status: 'PURCHASE_CONFIRMED',
        purchase_confirmed_at: new Date(),
      },
      select: { id: true, status: true, purchase_confirmed_at: true },
    });

    return {
      reservationId: confirmed.id,
      status: confirmed.status,
      purchaseConfirmedAt: confirmed.purchase_confirmed_at,
    };
  });
}
