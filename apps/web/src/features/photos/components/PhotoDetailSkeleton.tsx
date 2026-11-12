//상세 로딩 자리: 사진 + 제목만 회색 박스로, 레이아웃은 PhotoDetailContent CSS 재사용

import contentStyles from './PhotoDetailContent.module.css';
import styles from './PhotoDetailSkeleton.module.css';

export default function PhotoDetailSkeleton() {
  return (
    <div className={contentStyles.content}>
      <p role="status" className={styles.visuallyHidden}>
        사진을 불러오는 중이에요
      </p>

      <div className={contentStyles.imageArea} aria-hidden="true">
        <div className={`${styles.box} ${styles.photo}`} />
      </div>

      <div className={contentStyles.info} aria-hidden="true">
        <div className={contentStyles.summary}>
          <div
            className={`${styles.box} ${styles.line}`}
            style={{ width: '90%' }}
          />
          <div
            className={`${styles.box} ${styles.line}`}
            style={{ width: '60%' }}
          />
        </div>
      </div>
    </div>
  );
}
