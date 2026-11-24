import { useRef } from 'react';
import InfiniteScrollTrigger, {
  type InfiniteScrollTriggerProps,
} from '@/components/ui/InfiniteScrollTrigger';
import styles from './PhotoList.module.css';

export type PhotoListItem = {
  localId: string;
  previewUrl: string;
  //화면 낭독기용 이름 (업로드: 파일명 / 사진 관리: 사진 N)
  name: string;
  //필수 정보 미입력
  missingRequired: boolean;
  //대표사진 (썸네일 아래 띠)
  isRepresentative: boolean;
};

//무한스크롤 (사진 관리만 사용)
export type PhotoListLoadMore = Pick<
  InfiniteScrollTriggerProps,
  'hasNextPage' | 'isFetchingNextPage' | 'isError' | 'onLoadMore'
>;

type PhotoListProps = {
  photos: PhotoListItem[];
  selectedId: string | null;
  onSelect: (localId: string) => void;
  onRemove: (localId: string) => void;
  loadMore?: PhotoListLoadMore;
};

//왼쪽 썸네일 목록 (데스크톱 3열, 태블릿 · 모바일 가로 스크롤)
export default function PhotoList({
  photos,
  selectedId,
  onSelect,
  onRemove,
  loadMore,
}: PhotoListProps) {
  //무한스크롤 감지 기준
  const gridRef = useRef<HTMLUListElement>(null);

  return (
    <section className={styles.list} aria-labelledby="photo-list-title">
      <h3 id="photo-list-title" className={styles.title}>
        사진 {photos.length}장
      </h3>
      <ul ref={gridRef} className={styles.grid}>
        {photos.map(
          ({
            localId,
            previewUrl,
            name,
            missingRequired,
            isRepresentative,
          }) => {
            const selected = localId === selectedId;
            //화면 낭독기용 라벨
            const label = [
              name,
              isRepresentative && '(대표)',
              missingRequired && '(필수 정보 미입력)',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <li
                key={localId}
                className={styles.item}
                data-selected={selected || undefined}
                data-missing={missingRequired || undefined}
              >
                {/* 버튼 안에 버튼 불가 → 나란히 */}
                <button
                  type="button"
                  className={styles.select}
                  aria-pressed={selected}
                  aria-label={label}
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

                {isRepresentative && (
                  <span className={styles.badge} aria-hidden="true">
                    대표
                  </span>
                )}

                <button
                  type="button"
                  className={styles.removeButton}
                  aria-label={`${name} 빼기`}
                  onClick={() => onRemove(localId)}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            );
          },
        )}

        {loadMore && (
          <li className={styles.more}>
            <InfiniteScrollTrigger {...loadMore} root={gridRef} compact />
          </li>
        )}
      </ul>
    </section>
  );
}
