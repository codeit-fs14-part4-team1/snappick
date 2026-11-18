import styles from './PhotoList.module.css';

export type PhotoListItem = {
  localId: string;
  previewUrl: string;
  fileName: string;
  //필수 정보(촬영 카테고리)를 아직 안 채움
  missingRequired: boolean;
};

type PhotoListProps = {
  photos: PhotoListItem[];
  //지금 폼에서 편집 중인 사진
  selectedId: string | null;
  onSelect: (localId: string) => void;
  onRemove: (localId: string) => void;
};

//2단계 사진 목록: 데스크톱 3열, 태블릿·모바일 가로 스크롤
//썸네일: 선택 시 초록 테두리 / 필수 미입력 빨간 점 / 빼기 ✕
export default function PhotoList({
  photos,
  selectedId,
  onSelect,
  onRemove,
}: PhotoListProps) {
  return (
    <section className={styles.list} aria-labelledby="photo-list-title">
      <h3 id="photo-list-title" className={styles.title}>
        사진 {photos.length}장
      </h3>
      <ul className={styles.grid}>
        {photos.map(({ localId, previewUrl, fileName, missingRequired }) => {
          const selected = localId === selectedId;
          return (
            <li
              key={localId}
              className={styles.item}
              data-selected={selected || undefined}
              data-missing={missingRequired || undefined}
            >
              {/* 버튼 안에 버튼을 넣을 수 없어서 선택·빼기 버튼을 나란히 둔다 */}
              <button
                type="button"
                className={styles.select}
                aria-pressed={selected}
                aria-label={`${fileName}${missingRequired ? ' (필수 정보 미입력)' : ''}`}
                onClick={() => onSelect(localId)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: 미리보기라 next/image 최적화 대상이 아님 */}
                <img
                  className={styles.image}
                  src={previewUrl}
                  alt=""
                  decoding="async"
                />
              </button>

              {missingRequired && (
                <span className={styles.dot} aria-hidden="true" />
              )}

              <button
                type="button"
                className={styles.removeButton}
                aria-label={`${fileName} 빼기`}
                onClick={() => onRemove(localId)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
