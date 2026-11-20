import { useRef } from 'react';
import InfiniteScrollTrigger, {
  type InfiniteScrollTriggerProps,
} from '@/components/ui/InfiniteScrollTrigger';
import styles from './PhotoList.module.css';

export type PhotoListItem = {
  localId: string;
  previewUrl: string;
  //화면 낭독기가 부르는 이름 (업로드: 파일명 / 관리: 순서 "사진 N")
  name: string;
  //필수 정보(촬영 카테고리)를 아직 안 채움
  missingRequired: boolean;
  //지금 화면의 대표 (썸네일 아래 띠)
  isRepresentative: boolean;
};

//목록 끝 더 불러오기 (관리 모달만, 업로드는 생략)
export type PhotoListLoadMore = Pick<
  InfiniteScrollTriggerProps,
  'hasNextPage' | 'isFetchingNextPage' | 'isError' | 'onLoadMore'
>;

type PhotoListProps = {
  photos: PhotoListItem[];
  //지금 폼에서 편집 중인 사진
  selectedId: string | null;
  onSelect: (localId: string) => void;
  onRemove: (localId: string) => void;
  loadMore?: PhotoListLoadMore;
};

//2단계 사진 목록: 데스크톱 3열, 태블릿·모바일 가로 스크롤
//썸네일: 선택 시 초록 테두리 / 필수 미입력 빨간 점 / 빼기 ✕ / 대표 아래 띠
//loadMore가 있으면 목록 끝에 무한 스크롤 트리거 (감지 기준 = 이 목록 상자)
export default function PhotoList({
  photos,
  selectedId,
  onSelect,
  onRemove,
  loadMore,
}: PhotoListProps) {
  //스크롤되는 상자 = 그리드 (트리거가 이 안에서 보이는지 감지)
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
            //눈으로 보이는 표시(띠·빨간 점)를 화면 낭독기에도 같은 순서로 알림
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
                {/* 버튼 안에 버튼을 넣을 수 없어서 선택·빼기 버튼을 나란히 둔다 */}
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
