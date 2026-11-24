'use client';

import Button from '@/components/ui/Button';
import styles from './UploadQueue.module.css';

//타일용 사진 정보
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
  onRetryAll: () => void;
};

//전체 재시도는 실패 2장부터 (1장이면 타일 ↻와 같음)
const RETRY_ALL_MIN = 2;

//올린 사진 목록 (타일: 완료 ✓ / 업로드 중 % / 실패 ↻)
export default function UploadQueue({
  photos,
  onRemove,
  onRetry,
  onRetryAll,
}: UploadQueueProps) {
  const uploadedCount = photos.filter((p) => p.status === 'uploaded').length;
  const failedCount = photos.filter((p) => p.status === 'failed').length;

  return (
    <section className={styles.uploads} aria-labelledby="upload-list-title">
      <div className={styles.header}>
        <h3 id="upload-list-title" className={styles.uploadsTitle}>
          올린 사진 <span className={styles.count}>{uploadedCount}</span>
        </h3>
        {failedCount >= RETRY_ALL_MIN && (
          <Button
            variant="outline"
            size="sm"
            aria-label={`실패한 파일 ${failedCount}장 재시도`}
            onClick={onRetryAll}
          >
            실패한 파일 재시도
          </Button>
        )}
      </div>
      <ul className={styles.grid}>
        {photos.map(({ localId, file, previewUrl, status, progress }) => (
          <li key={localId} className={styles.tile} data-status={status}>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: 미리보기라 next/image 최적화 대상이 아님 */}
            <img
              className={styles.image}
              src={previewUrl}
              alt={file.name}
              decoding="async"
            />

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
                  <svg
                    className={styles.retryIcon}
                    viewBox="0 0 19 18"
                    width={19}
                    height={18}
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M14.58 1.5C16.46 2.7 18.34 5.26 18.34 8.6C18.34 13.36 14.5 17.2 9.74 17.2C4.98 17.2 1.14 13.36 1.14 8.6C1.14 6.2 2.1 4.02 3.68 2.5C2.74 2.52 1.5 2.34 0 1.92L0.74 1.02C2.9 1.02 4.76 0.66 6.32 0L6.76 0.359999C6.36 2.02 6.34 3.92 6.72 6.04L5.98 6.92C5.3 5.52 4.9 4.34 4.76 3.4C3.64 4.5 2.56 6.26 2.56 8.6C2.56 12.58 5.76 15.78 9.74 15.78C13.7 15.78 16.92 12.58 16.92 8.6C16.92 5.1 14.46 3.08 13.78 2.66L14.58 1.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* 처리 중엔 빼기 버튼 숨김 (빼도 업로드는 계속됨) */}
            {(status === 'uploaded' || status === 'failed') && (
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
