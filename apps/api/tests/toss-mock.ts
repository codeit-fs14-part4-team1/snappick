import { vi } from 'vitest';

type TossTarget = { paymentKey: string; orderId: string; amount: number };

/**
 * 토스페이먼츠 API를 가짜로 바꾼다 (fetch 가로채기)
 * 승인 성공은 결제창에서 받은 실제 paymentKey가 있어야 해서 서버 테스트로는 만들 수 없다
 * 그래서 승인 성공이 필요한 테스트에서만 쓰고, 나머지는 실제 토스 테스트 API를 호출한다
 * - POST /v1/payments/confirm: 항상 승인(DONE)
 * - GET /v1/payments/{paymentKey}: 승인했거나 preset한 결제면 DONE, 아니면 NOT_FOUND_PAYMENT
 * - 쓰는 동안 토스가 아닌 외부 주소로 요청이 나가면 테스트를 실패시킨다
 */
export function mockToss() {
  const payments = new Map<string, TossTarget>();
  const calls: { method: string; url: string; body?: TossTarget }[] = [];

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const done = (target: TossTarget) =>
    json(200, {
      paymentKey: target.paymentKey,
      orderId: target.orderId,
      totalAmount: target.amount,
      status: 'DONE',
    });

  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.startsWith('https://api.tosspayments.com/')) {
        throw new Error(`테스트 중 외부 요청 차단: ${url}`);
      }
      const method = init?.method ?? 'GET';

      if (url.endsWith('/confirm')) {
        const target = JSON.parse(String(init?.body)) as TossTarget;
        calls.push({ method, url, body: target });
        payments.set(target.paymentKey, target);
        return done(target);
      }

      calls.push({ method, url });
      const paymentKey = decodeURIComponent(url.split('/').at(-1) ?? '');
      const target = payments.get(paymentKey);
      return target ? done(target) : json(404, { code: 'NOT_FOUND_PAYMENT' });
    });

  return {
    calls,
    /** 이미 토스에서 승인된 결제로 둔다 (PENDING 결제의 조회용) */
    preset(target: TossTarget) {
      payments.set(target.paymentKey, target);
    },
    restore() {
      spy.mockRestore();
    },
  };
}
