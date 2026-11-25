'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import type { QuoteDraft } from '@/features/chats/quote';
import {
  formatQuoteDate,
  formatQuoteTime,
  getQuoteDeliveryDate,
} from '@/features/chats/quote';
import styles from './PaymentPage.module.css';

function PolicyChevron() {
  return (
    <svg
      className={styles.policyChevron}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.33 7.68L4.87 2.79H5.13L7.66 7.68H6.61L5 4.48L3.39 7.68H2.33Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function PaymentPage({
  quote,
  photographerName,
  profileImageUrl,
  representativeImageUrl,
  onPay,
  pending,
  revisedQuoteHref,
  checkoutLocked = false,
  paymentPending = false,
}: {
  quote: QuoteDraft;
  photographerName: string;
  profileImageUrl: string;
  representativeImageUrl: string | null;
  onPay: () => Promise<void>;
  pending: boolean;
  revisedQuoteHref?: string;
  checkoutLocked?: boolean;
  /** 이 견적의 결제 결과를 서버가 확인하는 중 */
  paymentPending?: boolean;
}) {
  const [agreed, setAgreed] = useState(false);

  const amount = `${quote.price.toLocaleString('ko-KR')}원`;
  const schedule = `${formatQuoteDate(quote.date)} ${formatQuoteTime(quote.startTime)}`;
  const duration = [
    Math.floor(quote.durationMinutes / 60)
      ? `${Math.floor(quote.durationMinutes / 60)}시간`
      : '',
    quote.durationMinutes % 60 ? `${quote.durationMinutes % 60}분` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <PageContainer className={styles.page}>
      <h1>결제하기</h1>
      <div className={styles.layout}>
        <div className={styles.content}>
          <section className={styles.panel} aria-labelledby="order-title">
            <h2 id="order-title">주문 내역</h2>
            <div className={styles.product}>
              {representativeImageUrl ? (
                <Image
                  src={representativeImageUrl}
                  alt=""
                  width={96}
                  height={72}
                  className={styles.productImage}
                />
              ) : (
                <span className={styles.productImage} aria-hidden="true" />
              )}
              <div className={styles.productInfo}>
                <h3>{quote.quoteName}</h3>
                <div className={styles.photographer}>
                  {profileImageUrl ? (
                    <Image
                      src={profileImageUrl}
                      alt=""
                      width={32}
                      height={32}
                      className={styles.avatar}
                    />
                  ) : (
                    <span className={styles.avatar} aria-hidden="true" />
                  )}
                  <strong>{photographerName}</strong>
                </div>
              </div>
            </div>
            <dl className={`${styles.rows} ${styles.orderRows}`}>
              <div>
                <dt>촬영 일시</dt>
                <dd>{schedule}</dd>
              </div>
              <div>
                <dt>촬영 장소</dt>
                <dd>{quote.location}</dd>
              </div>
              <div>
                <dt>촬영 시간</dt>
                <dd>{duration}</dd>
              </div>
              <div>
                <dt>제공 사진</dt>
                <dd>
                  {quote.photoCount === null
                    ? '별도 협의'
                    : `${quote.photoCount}장`}{' '}
                  · 원본 {quote.includesOriginal ? '제공' : '미제공'}
                </dd>
              </div>
              <div>
                <dt>납품 기한</dt>
                <dd>
                  {formatQuoteDate(
                    getQuoteDeliveryDate(quote.date).replaceAll('.', '-'),
                  )}
                  까지
                </dd>
              </div>
            </dl>
            <div className={styles.notices}>
              <h3>안내사항</h3>
              <div className={styles.noticeBox}>
                {quote.additionalNotice && (
                  <section>
                    <h4>추가 안내사항</h4>
                    <p>{quote.additionalNotice}</p>
                  </section>
                )}
                {quote.commonNotice && (
                  <section>
                    <h4>공통 안내사항</h4>
                    <p>{quote.commonNotice}</p>
                  </section>
                )}
              </div>
            </div>
          </section>
          <section className={styles.panel} aria-labelledby="method-title">
            <h2 id="method-title">결제 수단</h2>
            <label className={styles.method}>
              <input type="radio" name="payment-method" defaultChecked />
              토스페이먼츠
            </label>
            <p className={styles.help}>
              결제수단은 토스페이먼츠 결제창에서 선택할 수 있어요.
            </p>
          </section>
        </div>
        <form
          className={`${styles.panel} ${styles.summary}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !agreed ||
              pending ||
              revisedQuoteHref ||
              checkoutLocked ||
              paymentPending
            )
              return;
            void onPay();
          }}
        >
          <dl className={styles.rows}>
            <div className={styles.total}>
              <dt>결제 금액</dt>
              <dd>{amount}</dd>
            </div>
          </dl>
          <div className={styles.policy}>
            <details open={!revisedQuoteHref}>
              <summary>
                <span>취소·환불 규정</span>
                <PolicyChevron />
              </summary>
              <p>
                · 촬영 7일 전까지 취소: 전액 환불
                <br />· 촬영 3~6일 전 취소: 결제 금액의 30%를 공제하고 환불
                <br />· 촬영 2일 전 ~ 당일 취소: 환불 불가
                <br />· 작가 사정으로 취소되면 전액 환불돼요.
              </p>
            </details>
            <details open={!revisedQuoteHref}>
              <summary>
                <span>개인정보 제3자 제공</span>
                <PolicyChevron />
              </summary>
              <p>
                · 제공받는 자: 예약한 작가 ({photographerName})<br />· 제공
                항목: 닉네임, 촬영 일시·장소, 요청사항
                <br />· 제공 목적: 촬영 진행과 결과물 전달
                <br />· 보유 기간: 거래 완료 후 관계 법령에 따른 기간
              </p>
            </details>
          </div>
          <label className={styles.agreement}>
            <span className={styles.checkbox}>
              <input
                type="checkbox"
                required
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M7.7 15.28C7.51 14.76 7.31 14.28 7.1 13.84C6.89 13.38 6.66 12.94 6.41 12.52C6.16 12.09 5.88 11.66 5.57 11.22L6.7 10.48C7.08 11.03 7.4 11.6 7.68 12.19C7.96 12.78 8.22 13.36 8.44 13.93H8.49C8.73 13.12 9.01 12.32 9.34 11.54C9.68 10.76 10.04 10.01 10.43 9.3C10.83 8.58 11.26 7.91 11.7 7.3C12.16 6.68 12.63 6.13 13.11 5.65L14.2 6.61C13.56 7.21 12.94 7.92 12.34 8.75C11.74 9.57 11.18 10.51 10.67 11.57C10.17 12.62 9.74 13.78 9.38 15.07L7.7 15.28Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>위 내용을 모두 확인했고 결제에 동의해요 (필수)</span>
          </label>
          {revisedQuoteHref && (
            <div className={styles.revisedQuote} role="status">
              <span aria-hidden="true">!</span>
              <div>
                <strong>재견적이 도착했어요</strong>
                <p>작가님이 재견적을 보내서 이 견적으로는 결제할 수 없어요.</p>
                <Link href={revisedQuoteHref}>재견적 보기 →</Link>
              </div>
            </div>
          )}
          <Button
            fullWidth
            type="submit"
            disabled={
              !agreed ||
              pending ||
              Boolean(revisedQuoteHref) ||
              checkoutLocked ||
              paymentPending
            }
            startIcon={
              pending ? <span className={styles.spinner} /> : undefined
            }
          >
            {paymentPending
              ? '결제 확인 중'
              : pending
                ? '결제 진행 중…'
                : '동의하고 결제하기'}
          </Button>
          <p
            className={styles.help}
            role={paymentPending ? 'status' : undefined}
          >
            {paymentPending
              ? '결제 결과를 확인하고 있어요. 나가도 자동으로 처리돼요.'
              : '결제가 완료되면 예약이 바로 확정돼요.'}
          </p>
        </form>
      </div>
    </PageContainer>
  );
}
