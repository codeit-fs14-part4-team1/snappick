import styles from './PhotoPreview.module.css';

type PhotoPreviewProps = {
  previewUrl: string;
  //대체 텍스트
  name: string;
  //업로드에만 있음 → 없으면 파일 정보 줄 숨김
  fileName?: string;
  //바이트
  fileSize?: number;
  isRepresentative: boolean;
  onRepresentativeChange: (on: boolean) => void;
};

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 2단계 가운데: 큰 미리보기 + 파일 정보 + 대표 이미지 스위치
export default function PhotoPreview({
  previewUrl,
  name,
  fileName,
  fileSize,
  isRepresentative,
  onRepresentativeChange,
}: PhotoPreviewProps) {
  return (
    <div className={styles.preview}>
      {/* eslint-disable-next-line @next/next/no-img-element -- blob: 미리보기라 next/image 최적화 대상이 아님 */}
      <img
        className={styles.image}
        src={previewUrl}
        alt={name}
        decoding="async"
      />

      <div className={styles.info}>
        {fileName !== undefined && fileSize !== undefined && (
          <p className={styles.fileInfo}>
            {fileName} · {formatSize(fileSize)}
          </p>
        )}

        <label className={styles.switchRow}>
          {/* 실제 체크박스는 숨기고 스위치 모양만 그린다 (키보드 Space·화면 낭독기 그대로) */}
          <input
            type="checkbox"
            role="switch"
            className={styles.switchInput}
            checked={isRepresentative}
            onChange={(e) => onRepresentativeChange(e.target.checked)}
          />
          <span className={styles.switch} aria-hidden="true">
            <span className={styles.knob} />
          </span>
          대표 이미지로 설정
        </label>

        <p className={styles.hint}>
          대표 이미지는 1장이에요.
          <br />
          켜면 기존 대표 이미지가 바뀌어요.
        </p>
      </div>
    </div>
  );
}
