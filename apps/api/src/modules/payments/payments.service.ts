import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  PreparePaymentInput,
  ConfirmPaymentInput,
} from './payments.schema.js';
import {
  tossPaymentResponseSchema,
  tossErrorResponseSchema,
} from './payments.schema.js';
import { createReservation } from '../reservations/reservations.service.js';

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
        pg_payment_id: true,
        user_id: true,
        amount: true,
      },
    });

    const pendingPayment = relatedPayments.find(
      (payment) => payment.status === 'PENDING',
    );

    if (pendingPayment) {
      if (
        pendingPayment.quote_id === quote.id &&
        pendingPayment.user_id === quote.chat_room?.user_id &&
        pendingPayment.pg_payment_id
      ) {
        return {
          paymentId: pendingPayment.id,
          orderId: pendingPayment.pg_order_id,
          orderName: quote.quote_name,
          amount: pendingPayment.amount,
          status: 'PENDING' as const,
          paymentKey: pendingPayment.pg_payment_id,
          reused: true,
        };
      }

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
      (payment) => payment.status === 'READY' && payment.quote_id === quote.id,
    );

    const userId = quote.chat_room?.user_id;
    const photographerId = quote.photographer_id;

    if (!userId || !photographerId) {
      throw new HttpError(
        409,
        'QUOTE_UNAVAILABLE',
        '결제에 필요한 사용자 또는 작가 정보를 찾을 수 없습니다.',
      );
    }

    if (preparedPayment) {
      return {
        paymentId: preparedPayment.id,
        orderId: preparedPayment.pg_order_id,
        orderName: quote.quote_name,
        amount: preparedPayment.amount,
        status: preparedPayment.status,
        reused: true,
      };
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
      orderName: quote.quote_name,
      amount: payment.amount,
      status: payment.status,
    };
  });
}

export async function confirmPayment(
  accountId: string,
  input: ConfirmPaymentInput,
) {
  // 주문번호로 우리 DB의 결제 기록 조회
  const payment = await prisma.payments.findUnique({
    where: {
      pg_order_id: input.orderId,
    },
    include: {
      user: {
        select: {
          id: true,
          auth_account_id: true,
        },
      },
      quote: {
        select: { shooting_case_id: true },
      },
    },
  });

  if (!payment) {
    throw new HttpError(
      404,
      'PAYMENT_NOT_FOUND',
      '결제 정보를 찾을 수 없습니다.',
    );
  }

  if (!payment.user || payment.user?.auth_account_id !== accountId) {
    throw new HttpError(
      403,
      'PAYMENT_ACCESS_DENIED',
      '해당 결제에 접근할 권한이 없습니다.',
    );
  }

  // 토스 인증 결과의 금액과 우리 DB의 금액 비교
  if (payment.amount !== input.amount) {
    throw new HttpError(
      400,
      'PAYMENT_AMOUNT_MISMATCH',
      '결제 금액이 일치하지 않습니다.',
    );
  }

  if (payment.status === 'SUCCEEDED') {
    if (payment.pg_payment_id !== input.paymentKey) {
      throw new HttpError(
        409,
        'PAYMENT_KEY_MISMATCH',
        '기존 결제 요청과 결제 키가 일치하지 않습니다.',
      );
    }

    const reservation = await prisma.reservations.findUnique({
      where: { payment_id: payment.id },
      select: { id: true },
    });

    if (!reservation) {
      throw new HttpError(
        409,
        'PAYMENT_STATE_CHANGED',
        '결제에 연결된 예약을 찾을 수 없습니다.',
      );
    }

    return {
      paymentId: payment.id,
      status: 'SUCCEEDED',
      reservationId: reservation.id,
      notifications: [],
    };
  }

  if (payment.status === 'FAILED') {
    throw new HttpError(
      409,
      'PAYMENT_RETRY_REQUIRED',
      '실패한 결제입니다. 결제 페이지에서 다시 시작해 주세요.',
    );
  }

  const tossSecretKey = process.env.TOSS_SECRET_KEY;

  if (!tossSecretKey?.startsWith('test_')) {
    throw new HttpError(
      500,
      'TOSS_TEST_KEY_REQUIRED',
      '토스 테스트 시크릿 키 설정을 확인해 주세요.',
    );
  }

  // 토스 API에 전달할 인증값 생성. 토스가 요구하는 형태의 인증값임.
  const authorization =
    'Basic ' + Buffer.from(`${tossSecretKey}:`).toString('base64');

  const fetchTossPayment = async (): Promise<Response | undefined> => {
    const paymentKey = encodeURIComponent(input.paymentKey);

    try {
      return await fetch(
        `https://api.tosspayments.com/v1/payments/${paymentKey}`,
        {
          method: 'GET',
          headers: { Authorization: authorization },
        },
      );
    } catch {
      return undefined;
    }
  };

  if (payment.status === 'PENDING') {
    // 기존 결제 시도와 같은 키인지 확인합니다.
    if (payment.pg_payment_id !== input.paymentKey) {
      throw new HttpError(
        409,
        'PAYMENT_KEY_MISMATCH',
        '기존 결제 요청과 결제 키가 일치하지 않습니다.',
      );
    }
  } else {
    const shootingCaseId = payment.quote?.shooting_case_id;

    if (!shootingCaseId) {
      throw new HttpError(
        409,
        'QUOTE_UNAVAILABLE',
        '결제에 연결된 견적을 찾을 수 없습니다.',
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM shooting_cases
        WHERE id = ${shootingCaseId}::uuid
        FOR UPDATE
      `;

      const latestQuote = await tx.quotes.findFirst({
        where: { shooting_case_id: shootingCaseId },
        orderBy: { version: 'desc' },
        select: { id: true },
      });

      if (!latestQuote || latestQuote.id !== payment.quote_id) {
        throw new HttpError(
          409,
          'QUOTE_NOT_LATEST',
          '새 견적이 도착해서 이 견적은 결제할 수 없습니다.',
        );
      }

      return tx.payments.updateMany({
        where: {
          id: payment.id,
          status: 'READY',
        },
        data: {
          status: 'PENDING',
          pg_payment_id: input.paymentKey,
        },
      });
    });

    if (updated.count === 0) {
      throw new HttpError(
        409,
        'PAYMENT_NOT_READY',
        '이미 처리 중이거나 처리된 결제입니다.',
      );
    }
  }

  const readTossPayment = async (response: Response) => {
    const result = tossPaymentResponseSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    if (!result.success) {
      throw new HttpError(
        502,
        'TOSS_INVALID_RESPONSE',
        '토스 결제 응답을 확인할 수 없습니다.',
      );
    }
    const data = result.data;
    if (
      data.paymentKey !== input.paymentKey ||
      data.orderId !== input.orderId ||
      data.totalAmount !== input.amount
    ) {
      throw new HttpError(
        502,
        'TOSS_PAYMENT_MISMATCH',
        '토스 결제 정보가 일치하지 않습니다.',
      );
    }
    return data;
  };

  const readErrorCode = async (response: Response | undefined) => {
    if (!response || response.ok) return undefined;
    const result = tossErrorResponseSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    return result.success ? result.data.code : undefined;
  };

  let tossPayment: Awaited<ReturnType<typeof readTossPayment>> | undefined;
  let shouldConfirm = payment.status === 'READY';
  if (payment.status === 'PENDING') {
    const lookup = await fetchTossPayment();
    if (lookup?.ok) {
      tossPayment = await readTossPayment(lookup);
      shouldConfirm = tossPayment.status === 'IN_PROGRESS';
    } else {
      // 승인 전에는 결제 조회에 아직 기록이 없을 수 있습니다.
      shouldConfirm = (await readErrorCode(lookup)) === 'NOT_FOUND_PAYMENT';
    }
  }

  let approvalFailed = false;
  if (shouldConfirm) {
    const confirmation = await fetch(
      'https://api.tosspayments.com/v1/payments/confirm',
      {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
          'Idempotency-Key': payment.id,
        },
        body: JSON.stringify({
          paymentKey: input.paymentKey,
          orderId: input.orderId,
          amount: payment.amount,
        }),
      },
    ).catch(() => undefined);

    if (confirmation?.ok) {
      tossPayment = await readTossPayment(confirmation);
    } else {
      const confirmationCode = await readErrorCode(confirmation);
      const lookup = await fetchTossPayment();
      tossPayment = lookup?.ok ? await readTossPayment(lookup) : undefined;
      approvalFailed =
        (confirmationCode === 'REJECT_CARD_COMPANY' ||
          confirmationCode === 'NOT_FOUND_PAYMENT_SESSION') &&
        (await readErrorCode(lookup)) === 'NOT_FOUND_PAYMENT';
    }
  }

  if (
    approvalFailed ||
    tossPayment?.status === 'ABORTED' ||
    tossPayment?.status === 'EXPIRED'
  ) {
    const failed = await prisma.payments.updateMany({
      where: {
        id: payment.id,
        status: 'PENDING',
        pg_payment_id: input.paymentKey,
      },
      data: { status: 'FAILED' },
    });

    if (failed.count === 0) {
      throw new HttpError(
        409,
        'PAYMENT_STATE_CHANGED',
        '결제 상태가 변경되었습니다. 다시 확인해 주세요.',
      );
    }

    throw new HttpError(
      409,
      'PAYMENT_RETRY_REQUIRED',
      '결제가 실패했거나 만료되었습니다. 결제를 다시 시작해 주세요.',
    );
  }

  if (!tossPayment) {
    throw new HttpError(
      502,
      'TOSS_CONFIRM_FAILED',
      '토스 결제 상태를 확인할 수 없습니다.',
    );
  }

  // 토스에서 결제 완료 상태인지 확인
  if (tossPayment.status !== 'DONE') {
    throw new HttpError(
      409,
      'TOSS_PAYMENT_NOT_COMPLETED',
      '토스 결제가 아직 완료되지 않았습니다.',
    );
  }

  const userId = payment.user.id;

  return prisma.$transaction(async (tx) => {
    const completed = await tx.payments.updateMany({
      where: {
        id: payment.id,
        status: 'PENDING',
        pg_payment_id: input.paymentKey,
      },
      data: {
        status: 'SUCCEEDED',
        paid_at: new Date(),
      },
    });

    if (completed.count === 0) {
      const latestPayment = await tx.payments.findUnique({
        where: { id: payment.id },
        select: { status: true, pg_payment_id: true },
      });

      if (
        latestPayment?.status === 'SUCCEEDED' &&
        latestPayment.pg_payment_id === input.paymentKey
      ) {
        const reservation = await tx.reservations.findUnique({
          where: { payment_id: payment.id },
          select: { id: true },
        });

        if (reservation) {
          return {
            paymentId: payment.id,
            status: 'SUCCEEDED',
            reservationId: reservation.id,
            notifications: [],
          };
        }
      }

      throw new HttpError(
        409,
        'PAYMENT_STATE_CHANGED',
        '토스 결제는 승인됐지만 결제 상태를 확인해야 합니다.',
      );
    }

    const reservation = await createReservation(
      userId,
      {
        paymentId: payment.id,
      },
      tx,
    );

    return {
      paymentId: payment.id,
      status: 'SUCCEEDED',
      reservationId: reservation.reservationId,
      notifications: reservation.notifications,
    };
  });
}
