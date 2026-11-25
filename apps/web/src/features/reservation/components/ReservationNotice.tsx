import styles from './ReservationNotice.module.css';

// 견적서에 작성된 안내사항 데이터
type ReservationNoticeProps = {
  additionalNotice?: string | null;
  commonNotice?: string | null;
};

// 예약 상세의 추가 안내사항 및 공통 안내사항을 표시
export default function ReservationNotice({
  additionalNotice,
  commonNotice,
}: ReservationNoticeProps) {
  const additional = additionalNotice?.trim() ?? '';
  const common = commonNotice?.trim() ?? '';

  // 표시할 안내사항이 없다면 영역을 렌더링하지 않음
  if (!additional && !common) {
    return null;
  }

  return (
    <section className={styles.section} aria-label="안내사항">
      <h3 className={styles.sectionTitle}>안내사항</h3>

      <div className={styles.noticeBox}>
        {additional && (
          <div className={styles.noticeItem}>
            <h4 className={styles.noticeLabel}>추가 안내사항</h4>
            <p className={styles.noticeContent}>{additional}</p>
          </div>
        )}

        {common && (
          <div className={styles.noticeItem}>
            <h4 className={styles.noticeLabel}>공통 안내사항</h4>
            <p className={styles.noticeContent}>{common}</p>
          </div>
        )}
      </div>
    </section>
  );
}
