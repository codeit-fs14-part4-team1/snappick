import { HttpError } from '../../utils/http-error.js';
import {
  tossPaymentResponseSchema,
  tossErrorResponseSchema,
} from './payments.schema.js';

const TOSS_PAYMENTS_URL = 'https://api.tosspayments.com/v1/payments';
// 응답이 없는 요청이 승인 요청이나 정리 작업을 계속 붙잡지 않도록 제한
const LOOKUP_TIMEOUT_MS = 10 * 1000;
const CHANGE_TIMEOUT_MS = 30 * 1000;

// 승인 여부가 불확실하거나 결제 거절이 아닌 서버 설정 문제인 토스 오류
const UNCERTAIN_TOSS_ERROR_CODES = new Set([
  'ALREADY_PROCESSED_PAYMENT',
  'IDEMPOTENT_REQUEST_PROCESSING',
  'PROVIDER_ERROR',
  'INVALID_API_KEY',
]);
const UNCERTAIN_TOSS_HTTP_STATUSES = new Set([401, 408, 409, 429]);

// 우리 DB에 저장된 결제와 토스 결제를 대조할 때 쓰는 값
export type TossTarget = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type TossPayment = { status: string };

export type TossLookup =
  | { type: 'FOUND'; payment: TossPayment }
  | { type: 'NOT_FOUND' }
  | { type: 'UNKNOWN' };

// 토스가 요구하는 형태의 인증값. 테스트 키만 허용한다
export function getTossAuthorization(): string {
  const tossSecretKey = process.env.TOSS_SECRET_KEY;

  if (!tossSecretKey?.startsWith('test_')) {
    throw new HttpError(
      500,
      'TOSS_TEST_KEY_REQUIRED',
      '토스 테스트 시크릿 키 설정을 확인해 주세요.',
    );
  }

  return 'Basic ' + Buffer.from(`${tossSecretKey}:`).toString('base64');
}

function paymentUrl(target: TossTarget): string {
  return `${TOSS_PAYMENTS_URL}/${encodeURIComponent(target.paymentKey)}`;
}

async function readTossPayment(
  response: Response,
  target: TossTarget,
): Promise<TossPayment> {
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
    data.paymentKey !== target.paymentKey ||
    data.orderId !== target.orderId ||
    data.totalAmount !== target.amount
  ) {
    throw new HttpError(
      502,
      'TOSS_PAYMENT_MISMATCH',
      '토스 결제 정보가 일치하지 않습니다.',
    );
  }

  return data;
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  const result = tossErrorResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  return result.success ? result.data.code : undefined;
}

// 토스가 승인을 명확히 거절한 경우만 true (결과가 불확실하면 이중 결제를 막기 위해 false)
function isDefiniteRejection(httpStatus: number, code: string | undefined) {
  return (
    httpStatus >= 400 &&
    httpStatus < 500 &&
    !UNCERTAIN_TOSS_HTTP_STATUSES.has(httpStatus) &&
    code !== undefined &&
    !UNCERTAIN_TOSS_ERROR_CODES.has(code)
  );
}

export async function lookupTossPayment(
  target: TossTarget,
): Promise<TossLookup> {
  const authorization = getTossAuthorization();
  const response = await fetch(paymentUrl(target), {
    method: 'GET',
    headers: { Authorization: authorization },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  }).catch(() => undefined);

  if (!response) {
    return { type: 'UNKNOWN' };
  }
  if (response.ok) {
    return { type: 'FOUND', payment: await readTossPayment(response, target) };
  }
  return (await readErrorCode(response)) === 'NOT_FOUND_PAYMENT'
    ? { type: 'NOT_FOUND' }
    : { type: 'UNKNOWN' };
}

/**
 * 토스 결제 승인
 * - 승인 응답이 실패면 다시 조회해 실제 상태를 확인한다
 * - rejected: 토스가 거절했고 조회에서도 승인되지 않은 것이 확인된 경우
 * - errorCode: 승인 실패 시 토스 오류 코드 (원인 기록용)
 */
export async function approveTossPayment(
  target: TossTarget,
  idempotencyKey: string,
): Promise<{
  payment: TossPayment | undefined;
  rejected: boolean;
  errorCode?: string | undefined;
}> {
  const authorization = getTossAuthorization();
  const response = await fetch(`${TOSS_PAYMENTS_URL}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(target),
    signal: AbortSignal.timeout(CHANGE_TIMEOUT_MS),
  }).catch(() => undefined);

  if (response?.ok) {
    return {
      payment: await readTossPayment(response, target),
      rejected: false,
    };
  }

  const code = response && (await readErrorCode(response));
  const lookup = await lookupTossPayment(target);
  const payment = lookup.type === 'FOUND' ? lookup.payment : undefined;
  const notApproved =
    lookup.type === 'NOT_FOUND' || payment?.status === 'IN_PROGRESS';

  return {
    payment,
    errorCode: code,
    rejected:
      notApproved &&
      response !== undefined &&
      isDefiniteRejection(response.status, code),
  };
}

// 토스 결제를 전액 취소하고, 취소가 확인되지 않으면 오류를 던진다
// 전액 취소는 중복되지 않으므로, 실패 응답이 재사용되지 않게 멱등키를 쓰지 않는다
export async function cancelTossPayment(
  target: TossTarget,
  cancelReason: string,
): Promise<void> {
  const authorization = getTossAuthorization();
  const response = await fetch(`${paymentUrl(target)}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cancelReason }),
    signal: AbortSignal.timeout(CHANGE_TIMEOUT_MS),
  }).catch(() => undefined);

  let canceled: TossPayment | undefined;
  if (response?.ok) {
    canceled = await readTossPayment(response, target);
  } else {
    // 응답을 받지 못했거나 이미 취소된 결제일 수 있으므로 다시 조회한다
    const lookup = await lookupTossPayment(target);
    canceled = lookup.type === 'FOUND' ? lookup.payment : undefined;
  }

  if (canceled?.status !== 'CANCELED') {
    throw new HttpError(
      502,
      'TOSS_CANCEL_FAILED',
      '토스 결제 취소를 확인할 수 없습니다.',
    );
  }
}
