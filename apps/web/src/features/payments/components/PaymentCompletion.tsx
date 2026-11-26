import Link from 'next/link';
import PageContainer from '@/components/layout/PageContainer';
import {
  formatQuoteDate,
  formatQuoteTime,
  toQuoteDraft,
  type Quote,
} from '@/features/chats/quote';
import styles from './PaymentPage.module.css';

export default function PaymentCompletion({
  reservationId,
  reservationNumber,
  amount,
  quote,
  chatHref,
}: {
  reservationId: string;
  reservationNumber: string;
  amount: number;
  quote?: Quote;
  chatHref: string;
}) {
  const draft = quote ? toQuoteDraft(quote) : null;
  return (
    <PageContainer className={styles.completion}>
      <div className={styles.successIcon} aria-hidden="true">
        ✓
      </div>
      <h1>결제가 완료됐어요</h1>
      <p>예약이 확정됐어요. 예약 내역에서 확인해 주세요.</p>
      <div className={styles.receipt}>
        <dl className={styles.rows}>
          <div>
            <dt>예약 번호</dt>
            <dd>{reservationNumber}</dd>
          </div>
          <div>
            <dt>견적명</dt>
            <dd>{draft?.quoteName ?? '결제한 견적'}</dd>
          </div>
          {draft && (
            <>
              <div>
                <dt>촬영 일시</dt>
                <dd>
                  {formatQuoteDate(draft.date)}{' '}
                  {formatQuoteTime(draft.startTime)}
                </dd>
              </div>
              <div>
                <dt>촬영 장소</dt>
                <dd>{draft.location}</dd>
              </div>
            </>
          )}
          <div>
            <dt>결제 수단</dt>
            <dd>{amount === 0 ? '무료' : '토스페이먼츠'}</dd>
          </div>
          <div>
            <dt>결제 금액</dt>
            <dd>{amount.toLocaleString('ko-KR')}원</dd>
          </div>
        </dl>
      </div>
      <div className={styles.completionActions}>
        <Link className={styles.backLink} href={chatHref}>
          채팅으로 돌아가기
        </Link>
        <Link
          className={styles.backLink}
          href={`/my/reservations/${encodeURIComponent(reservationId)}`}
        >
          예약 상세 보기
        </Link>
      </div>
    </PageContainer>
  );
}
