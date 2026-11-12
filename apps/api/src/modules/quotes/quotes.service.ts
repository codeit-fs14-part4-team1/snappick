import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateQuoteInput } from './quotes.schema.js';

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

  const product = await prisma.products.findFirst({
    where: {
      id: input.productId,
      photographer_id: photographer.id,
    },
  });

  if (!product) {
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

      // 해당 촬영 건의 견적으로 생성된 진행 중 예약 찾기
      const activeReservation = await tx.reservations.findFirst({
        where: {
          quote: {
            is: {
              shooting_case_id: shootingCase.id,
            },
          },
          status: {
            in: ['CONFIRMED', 'SHOOT_COMPLETED', 'DELIVERED'],
          },
        },
      });

      if (activeReservation) {
        throw new HttpError(
          409,
          'ACTIVE_RESERVATION_EXISTS',
          '이 촬영 건에 진행 중인 예약이 있습니다.',
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
      },
    });

    // 기존 견적이 없으면 1, 있으면 마지막 버전 + 1
    const nextVersion = (latestQuote?.version ?? 0) + 1;

    // 견적 저장
    const quote = await tx.quotes.create({
      data: {
        chat_room_id: input.chatRoomId,
        shooting_case_id: shootingCaseId,
        photographer_id: photographer.id,
        product_name: product.name,
        version: nextVersion,
        shoot_at: new Date(input.shootAt),
        location: input.location,
        duration_minutes: input.durationMinutes,
        price: input.price,
        photo_count: input.photoCount ?? null,
        includes_original: input.includesOriginal,
        additional_notice: input.additionalNotice?.trim() || null,
        common_notice: product.common_notice,
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

    return {
      quote,
      message,
    };
  });
}
