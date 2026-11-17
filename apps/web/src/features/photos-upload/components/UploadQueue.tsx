'use client';

import styles from './UploadQueue.module.css';

// 타일에 필요한 사진 정보 (모달의 SelectedPhoto가 그대로 들어온다)
export type UploadQueuePhoto = {
  localId: string;
  file: File;
  previewUrl: string;
  status: 'preparing' | 'waiting' | 'uploading' | 'uploaded' | 'failed';
  progress: number;
};

type UploadQueueProps = {
  photos: UploadQueuePhoto[];
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
};

// 1단계 올린 사진 목록: 제목(완료 장수) + 120px 타일
// 타일: 완료 ✓ / 업로드 중 % / 실패 ↻ / 준비 중·대기 중은 이미지만
export default function UploadQueue({
  photos,
  onRemove,
  onRetry,
}: UploadQueueProps) {
  const uploadedCount = photos.filter((p) => p.status === 'uploaded').length;

  return (
    <section className={styles.uploads} aria-labelledby="upload-list-title">
      <h3 id="upload-list-title" className={styles.uploadsTitle}>
        올린 사진 <span className={styles.count}>{uploadedCount}</span>
      </h3>
      <ul className={styles.grid}>
        {photos.map(({ localId, file, previewUrl, status, progress }) => (
          <li key={localId} className={styles.tile} data-status={status}>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: 미리보기라 next/image 최적화 대상이 아님 */}
            <img className={styles.image} src={previewUrl} alt={file.name} />

            {status === 'uploading' && (
              <div className={styles.overlay}>
                <span className={styles.percent}>{progress}%</span>
                <div
                  className={styles.track}
                  role="progressbar"
                  aria-label={`${file.name} 업로드 진행률`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className={styles.fill}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'uploaded' && (
              <span className={styles.doneBadge} aria-label="업로드 완료">
                ✓
              </span>
            )}

            {status === 'failed' && (
              <div className={styles.overlay}>
                <span className={styles.failedBadge}>실패</span>
                <button
                  type="button"
                  className={styles.retryButton}
                  aria-label={`${file.name} 다시 올리기`}
                  onClick={() => onRetry(localId)}
                >
                  <span aria-hidden="true">↻</span>
                </button>
              </div>
            )}

            {/* 업로드 중에는 빼지 않는다 (전송 중단 없음) */}
            {status !== 'uploading' && (
              <button
                type="button"
                className={styles.removeButton}
                aria-label={`${file.name} 빼기`}
                onClick={() => onRemove(localId)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
