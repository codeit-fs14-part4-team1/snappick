'use client';

import { useId, useState } from 'react';
import type { Quote } from '../quote';
import {
  formatQuoteDate,
  formatQuoteTime,
  getQuoteDeliveryDate,
  toQuoteDraft,
} from '../quote';
import { formatChatTime } from '../utils';
import styles from './QuoteMessageCard.module.css';
import Button from '@/components/ui/Button';
import QuoteNoticeList from './QuoteNoticeList';

export default function QuoteMessageCard({
  quote: savedQuote,
  createdAt,
  received = false,
  superseded = false,
  onEdit,
  onPay,
}: {
  quote: Quote;
  createdAt: string;
  received?: boolean;
  superseded?: boolean;
  onEdit?: () => void;
  onPay?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const quote = toQuoteDraft(savedQuote);
  const sentDate = new Date(Date.parse(createdAt) + 9 * 60 * 60 * 1000);
  const sentDateLabel = Number.isFinite(sentDate.getTime())
    ? sentDate.toISOString().slice(0, 10).replaceAll('-', '.')
    : '';
  const hours = quote.durationMinutes / 60;
  const isLatest = savedQuote.isLatest && !superseded;
  // TODO(결제 API 연동): reservationStatus 응답 연결 후 결제 완료 표시와 결제·수정 제한을 검증합니다.
  const isReserved = Boolean(
    savedQuote.reservationStatus && savedQuote.reservationStatus !== 'CANCELED',
  );

  return (
    <article className={styles.card} aria-label={`${quote.quoteName} 견적서`}>
      {!isLatest && (
        <p className={styles.previousNotice}>이전 버전의 견적서예요</p>
      )}
      <div
        id={detailsId}
        className={styles.quoteDetailsLayout}
        hidden={!isLatest && !expanded}
      >
        <header className={styles.heading}>
          <span>
            {!isLatest && <span className={styles.badge}>이전 견적</span>}
            {isLatest && (
              <span className={styles.badge}>
                {savedQuote.version > 1 ? '최신 견적' : '새 견적'}
              </span>
            )}
          </span>
          <strong>{quote.quoteName}</strong>
        </header>
        <p className={styles.price}>{quote.price.toLocaleString('ko-KR')}원</p>
        <dl className={styles.details}>
          <div>
            <dt>촬영 일시</dt>
            <dd>
              {formatQuoteDate(quote.date)} {formatQuoteTime(quote.startTime)}
            </dd>
          </div>
          <div>
            <dt>촬영 장소</dt>
            <dd>{quote.location}</dd>
          </div>
          <div>
            <dt>촬영 시간</dt>
            <dd>
              {Number.isInteger(hours)
                ? `${hours}시간`
                : `${Math.floor(hours)}시간 ${quote.durationMinutes % 60}분`}
            </dd>
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
        {(quote.additionalNotice || quote.commonNotice) && (
          <div className={styles.notices}>
            {quote.additionalNotice && (
              <section>
                <h3>추가 안내사항</h3>
                <p>{quote.additionalNotice}</p>
              </section>
            )}
            {quote.commonNotice && (
              <section>
                <h3>공통 안내사항</h3>
                <QuoteNoticeList text={quote.commonNotice} />
              </section>
            )}
          </div>
        )}
        {isReserved && (
          <Button fullWidth disabled>
            결제 완료 · 예약 확정
          </Button>
        )}
        {received && !isReserved && (
          <div className={styles.payment}>
            {isLatest && (
              <Button fullWidth disabled={!onPay} onClick={onPay}>
                결제하기
              </Button>
            )}
            {!isLatest && (
              <p
                id={`quote-${savedQuote.id}-payment-notice`}
                className={styles.paymentNotice}
              >
                결제는 최신 견적에서 진행해 주세요
              </p>
            )}
          </div>
        )}
        {onEdit && isLatest && !isReserved && (
          <Button fullWidth variant="outline" onClick={onEdit}>
            수정하기
          </Button>
        )}
      </div>
      {!isLatest && (
        <Button
          fullWidth
          variant="outline"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '상세 접기' : '상세 보기'}
        </Button>
      )}
      <time className={styles.sentAt} dateTime={createdAt}>
        {sentDateLabel} {formatChatTime(createdAt)} 보냄
      </time>
    </article>
  );
}
