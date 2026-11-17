import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { PreparePaymentInput } from './payments.schema.js';

export async function preparePayment(
  accountId: string,
  input: PreparePaymentInput,
) {
  // 결제할 견적과 해당 견적의 채팅방 사용자 정보 조회
  const quote = await prisma.quotes.findUnique({
    where: {
      id: input.quoteId,
    },
    include: {
      chat_room: {
        include: {
          user: {
            select: {
              auth_account_id: true,
            },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new HttpError(404, 'QUOTE_NOT_FOUND', '견적을 찾을 수 없습니다.');
  }

  // 견적이 속한 채팅방의 사용자 계정 ID
  const userAccountId = quote.chat_room?.user?.auth_account_id;

  if (accountId !== userAccountId) {
    throw new HttpError(
      403,
      'QUOTE_ACCESS_DENIED',
      '해당 견적을 결제할 권한이 없습니다.',
    );
  }

  return prisma.$transaction(async (tx) => {
    // 같은 촬영 건의 결제 준비와 재견적이 동시에 처리되지 않도록 잠금
    await tx.$queryRaw`
    SELECT id
    FROM shooting_cases
    WHERE id = ${quote.shooting_case_id}::uuid
    FOR UPDATE
  `;

    // 해당 촬영 건의 가장 높은 견적 버전 조회
    const latestQuote = await tx.quotes.findFirst({
      where: {
        shooting_case_id: quote.shooting_case_id,
      },
      orderBy: {
        version: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (!latestQuote || latestQuote.id !== quote.id) {
      throw new HttpError(
        409,
        'QUOTE_NOT_LATEST',
        '새 견적이 도착해서 이 견적은 결제할 수 없습니다.',
      );
    }

    // 이 견적으로 이미 만들어진 예약 확인
    const existingReservation = await tx.reservations.findFirst({
      where: {
        quote_id: quote.id,
      },
      select: {
        id: true,
      },
    });

    if (existingReservation) {
      throw new HttpError(
        409,
        'QUOTE_ALREADY_RESERVED',
        '이미 예약이 생성된 견적입니다.',
      );
    }

    // 같은 촬영 건에 진행 중인 다른 예약 확인
    const activeReservation = await tx.reservations.findFirst({
      where: {
        quote: {
          is: {
            shooting_case_id: quote.shooting_case_id,
          },
        },
        status: {
          in: ['CONFIRMED', 'SHOOT_COMPLETED', 'DELIVERED'],
        },
      },
      select: {
        id: true,
      },
    });

    if (activeReservation) {
      throw new HttpError(
        409,
        'ACTIVE_RESERVATION_EXISTS',
        '이 촬영 건에 진행 중인 예약이 있습니다.',
      );
    }

    // 같은 촬영 건의 진행 중이거나 성공한 결제 조회
    const relatedPayments = await tx.payments.findMany({
      where: {
        quote: {
          is: {
            shooting_case_id: quote.shooting_case_id,
          },
        },
        status: {
          in: ['READY', 'PENDING', 'SUCCEEDED'],
        },
      },
      select: {
        id: true,
        quote_id: true,
        status: true,
        pg_order_id: true,
      },
    });

    const pendingPayment = relatedPayments.find(
      (payment) => payment.status === 'PENDING',
    );

    if (pendingPayment) {
      throw new HttpError(
        409,
        'PAYMENT_IN_PROGRESS',
        '이 촬영 건의 결제가 처리 중입니다.',
      );
    }

    const successfulPayment = relatedPayments.find(
      (payment) => payment.status === 'SUCCEEDED',
    );

    if (successfulPayment) {
      throw new HttpError(
        409,
        'PAYMENT_ALREADY_SUCCEEDED',
        '이 촬영 건에 이미 성공한 결제가 있습니다.',
      );
    }

    // 같은 촬영 건에 이미 준비된 결제가 있으면 중복 생성 차단
    const preparedPayment = relatedPayments.find(
      (payment) => payment.status === 'READY',
    );

    if (preparedPayment) {
      throw new HttpError(
        409,
        'PAYMENT_ALREADY_PREPARED',
        '이 촬영 건에 이미 준비된 결제가 있습니다.',
      );
    }

    const userId = quote.chat_room?.user_id;
    const photographerId = quote.photographer_id;

    if (!userId || !photographerId) {
      throw new HttpError(
        409,
        'QUOTE_UNAVAILABLE',
        '결제에 필요한 사용자 또는 작가 정보를 찾을 수 없습니다.',
      );
    }

    // 견적에 저장된 최종 금액으로 결제 준비
    const payment = await tx.payments.create({
      data: {
        quote_id: quote.id,
        user_id: userId,
        photographer_id: photographerId,
        amount: quote.price,
        payment_method: 'EASY_PAY',
        pg_provider: 'TOSS',
        status: 'READY',
      },
    });

    return {
      paymentId: payment.id,
      orderId: payment.pg_order_id,
      orderName: quote.product_name,
      amount: payment.amount,
      status: payment.status,
    };
  });
}
