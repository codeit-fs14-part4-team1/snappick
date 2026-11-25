import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateQuoteInput } from './quotes.schema.js';
import {
  createNotification,
  notificationMessages,
} from '../notifications/notifications.create.js';

export async function createQuote(accountId: string, input: CreateQuoteInput) {
  const chatRoom = await prisma.chat_rooms.findUnique({
    where: {
      id: input.chatRoomId,
    },
    include: {
      user: {
        select: {
          auth_account_id: true,
        },
      },
      photographer: {
        select: {
          id: true,
          auth_account_id: true,
          auth_account: { select: { nickname: true } },
        },
      },
    },
  });

  if (!chatRoom) {
    throw new HttpError(
      404,
      'CHAT_ROOM_NOT_FOUND',
      '존재하지 않는 문의입니다.',
    );
  }

  const photographer = chatRoom.photographer;

  if (!photographer || photographer.auth_account_id !== accountId) {
    throw new HttpError(
      403,
      'CHAT_ROOM_ACCESS_DENIED',
      '해당 문의의 작가만 견적을 보낼 수 있습니다.',
    );
  }

  const recipientAccountId = chatRoom.user?.auth_account_id;

  if (!recipientAccountId) {
    throw new HttpError(
      422,
      'PARTNER_WITHDRAWN',
      '상대방이 탈퇴하여 견적을 보낼 수 없습니다.',
    );
  }

  const product = input.productId
    ? await prisma.products.findFirst({
        where: {
          id: input.productId,
          photographer_id: photographer.id,
        },
      })
    : null;

  if (input.productId && !product) {
    throw new HttpError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.');
  }

  // 촬영 건, 견적, 채팅 메시지를 하나의 트랜잭션에서 처리
  return prisma.$transaction(async (tx) => {
    let shootingCaseId: string;

    if (input.shootingCaseId) {
      // 기존 촬영 건에 대한 견적이라면 해당 행을 잠금
      await tx.$queryRaw`
        SELECT id
        FROM shooting_cases
        WHERE id = ${input.shootingCaseId}::uuid
          AND chat_room_id = ${input.chatRoomId}::uuid
        FOR UPDATE
      `;

      // 촬영 건이 존재하고 현재 채팅방에 속하는지 확인
      const shootingCase = await tx.shooting_cases.findFirst({
        where: {
          id: input.shootingCaseId,
          chat_room_id: input.chatRoomId,
        },
      });

      if (!shootingCase) {
        throw new HttpError(
          404,
          'SHOOTING_CASE_NOT_FOUND',
          '해당 문의의 촬영 건을 찾을 수 없습니다.',
        );
      }

      const reservation = await tx.reservations.findFirst({
        where: {
          quote: {
            is: {
              shooting_case_id: shootingCase.id,
            },
          },
          status: {
            in: [
              'CONFIRMED',
              'SHOOT_COMPLETED',
              'DELIVERED',
              'CANCELED',
              'PURCHASE_CONFIRMED',
            ],
          },
        },
        select: { status: true },
      });

      if (reservation?.status === 'CANCELED') {
        throw new HttpError(
          409,
          'SHOOTING_CASE_CANCELED',
          '예약이 취소된 촬영 건이에요. 새 견적을 보내 주세요.',
        );
      }

      if (reservation?.status === 'PURCHASE_CONFIRMED') {
        throw new HttpError(
          409,
          'SHOOTING_CASE_PURCHASE_CONFIRMED',
          '구매가 확정된 촬영 건이에요. 새 견적을 보내 주세요.',
        );
      }

      if (reservation) {
        throw new HttpError(
          409,
          'ACTIVE_RESERVATION_EXISTS',
          '이 촬영 건에 진행 중인 예약이 있습니다.',
        );
      }

      const pendingPayment = await tx.payments.findFirst({
        where: {
          status: 'PENDING',
          quote: {
            is: {
              shooting_case_id: shootingCase.id,
            },
          },
        },
        select: { id: true },
      });

      if (pendingPayment) {
        throw new HttpError(
          409,
          'PAYMENT_IN_PROGRESS',
          '결제 처리 중에는 재견적을 보낼 수 없습니다.',
        );
      }

      shootingCaseId = shootingCase.id;
    } else {
      // 촬영 건 ID가 없으면 새 촬영 건을 만듬
      const newShootingCase = await tx.shooting_cases.create({
        data: {
          chat_room_id: input.chatRoomId,
        },
      });

      shootingCaseId = newShootingCase.id;
    }

    // 해당 촬영 건의 가장 최근 견적 버전을 조회
    const latestQuote = await tx.quotes.findFirst({
      where: {
        shooting_case_id: shootingCaseId,
      },
      orderBy: {
        version: 'desc',
      },
      select: {
        version: true,
        common_notice: true,
      },
    });

    // 기존 견적이 없으면 1, 있으면 마지막 버전 + 1
    // 촬영 건 행을 잠근 뒤 검사하여 동시 재견적도 같은 버전에서 중복 발행하지 않습니다.
    if (
      input.shootingCaseId &&
      latestQuote?.version !== input.expectedVersion
    ) {
      throw new HttpError(
        409,
        'QUOTE_VERSION_CONFLICT',
        '새 재견적이 발행되었습니다. 최신 견적에서 다시 수정해 주세요.',
      );
    }
    const nextVersion = (latestQuote?.version ?? 0) + 1;
    if (!product && !latestQuote) {
      throw new HttpError(
        400,
        'PRODUCT_REQUIRED',
        '새 견적을 작성할 촬영 상품을 선택해 주세요.',
      );
    }

    // 견적 저장
    const quote = await tx.quotes.create({
      data: {
        chat_room_id: input.chatRoomId,
        shooting_case_id: shootingCaseId,
        photographer_id: photographer.id,
        quote_name: input.quoteName,
        version: nextVersion,
        shoot_at: new Date(input.shootAt),
        location: input.location,
        location_lat: input.locationLat,
        location_lng: input.locationLng,
        duration_minutes: input.durationMinutes,
        price: input.price,
        photo_count: input.photoCount ?? null,
        includes_original: input.includesOriginal,
        additional_notice: input.additionalNotice?.trim() || null,
        common_notice: product
          ? product.common_notice
          : latestQuote!.common_notice,
      },
    });

    // 견적과 연결된 채팅 메시지를 저장
    const message = await tx.chat_messages.create({
      data: {
        chat_room_id: input.chatRoomId,
        recipient_account_id: recipientAccountId,
        message_type: 'QUOTE',
        content: '견적서가 도착했습니다.',
        quote_id: quote.id,
      },
    });

    // 새 메시지가 더 최신인 경우에만 채팅방 시각을 갱신
    await tx.chat_rooms.updateMany({
      where: {
        id: input.chatRoomId,
        last_message_at: {
          lt: message.created_at,
        },
      },
      data: {
        last_message_at: message.created_at,
      },
    });

    const notification = await createNotification(
      {
        accountId: recipientAccountId,
        type: 'NEW_QUOTE',
        targetId: input.chatRoomId,
        message: notificationMessages.newQuote(
          photographer.auth_account.nickname,
        ),
      },
      tx,
    );

    return {
      quote,
      message,
      notification,
    };
  });
}

export async function getQuote(accountId: string, quoteId: string) {
  const quote = await prisma.quotes.findUnique({
    where: {
      id: quoteId,
    },
    include: {
      reservation: { select: { id: true, status: true } },
      shooting_case: {
        select: {
          quotes: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
      },
      chat_room: {
        include: {
          user: {
            select: { auth_account_id: true },
          },
          photographer: {
            select: {
              auth_account_id: true,
              representativePhoto: {
                select: { photo: { select: { storage_location: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new HttpError(404, 'QUOTE_NOT_FOUND', '견적을 찾을 수 없습니다.');
  }

  const userAccountId = quote.chat_room?.user?.auth_account_id;
  const photographerAccountId = quote.chat_room?.photographer?.auth_account_id;

  if (accountId !== userAccountId && accountId !== photographerAccountId) {
    throw new HttpError(
      403,
      'CHAT_ROOM_ACCESS_DENIED',
      '해당 문의에 접근할 권한이 없습니다.',
    );
  }

  return quote;
}
