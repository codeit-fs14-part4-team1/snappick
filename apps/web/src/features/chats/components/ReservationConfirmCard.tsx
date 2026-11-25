import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDate } from '@/utils/dateTime';
import {
  formatQuoteDate,
  formatQuoteTime,
  toQuoteDraft,
  type Quote,
} from '../quote';
import styles from './ReservationConfirmCard.module.css';

/** 예약 확정 시스템 메시지에 결제한 견적의 예약 정보를 표시합니다. */
export default function ReservationConfirmCard({
  quote,
  now,
}: {
  quote: Quote;
  now: string;
}) {
  const draft = toQuoteDraft(quote);
  const today = formatDate(now).replaceAll('.', '-');
  const days = Math.round(
    (Date.parse(draft.date) - Date.parse(today)) / 86400000,
  );
  return (
    <article className={styles.card} aria-label="예약 확정 안내">
      <header className={styles.header}>
        <StatusBadge variant="confirmed">예약 확정</StatusBadge>
        {Number.isFinite(days) && days >= 0 && (
          <span className={styles.countdown}>
            {days === 0 ? 'D-day' : `D-${days}`}
          </span>
        )}
      </header>
      <div className={styles.heading}>
        <h3>예약이 확정됐어요</h3>
        <p>{quote.quoteName}</p>
      </div>
      <dl className={styles.details}>
        <div>
          <dt>촬영 일시</dt>
          <dd>
            {formatQuoteDate(draft.date)} {formatQuoteTime(draft.startTime)}
          </dd>
        </div>
        <div>
          <dt>촬영 장소</dt>
          <dd>{quote.location}</dd>
        </div>
        <div>
          <dt>결제 금액</dt>
          <dd>{quote.price.toLocaleString('ko-KR')}원</dd>
        </div>
      </dl>
      {/* TODO: 예약 상세 페이지가 구현되면 reservationId로 연결합니다. */}
      {quote.reservationId && (
        <Button
          className={styles.detailAction}
          variant="outline"
          fullWidth
          disabled
        >
          예약 상세 보기
        </Button>
      )}
    </article>
  );
}
