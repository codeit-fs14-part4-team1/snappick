import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import buttonStyles from '@/components/ui/Button.module.css';
import { formatDate } from '@/utils/dateTime';
import {
  formatQuoteDate,
  formatQuoteTime,
  toQuoteDraft,
  type Quote,
} from '../quote';
import styles from './ReservationConfirmCard.module.css';

/** 결제한 견적의 예약 정보를 표시합니다. 별도 채팅 메시지를 생성하지 않습니다. */
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
      {quote.reservationId && (
        <Link
          className={`${buttonStyles.button} ${buttonStyles.outline} ${buttonStyles.md} ${buttonStyles.fullWidth} ${styles.link}`}
          href={`/my/reservations/${encodeURIComponent(quote.reservationId)}`}
        >
          예약 상세 보기
        </Link>
      )}
    </article>
  );
}
