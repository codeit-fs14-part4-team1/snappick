'use client';

import Image from 'next/image';
import Button from '@/components/ui/Button';
import Masonry from '@/components/ui/Masonry';
import styles from './PhotographerPortfolio.module.css';

// 포트폴리오 사진 데이터 타입 정의
export type PortfolioPhoto = {
  photoId: string;
  imageUrl: string | null;
  width: number;
  height: number;

  // 썸네일 표시 비율 지정, 없으면 원본 비율 사용
  displayAspectRatio?: string;
};

type PhotographerPortfolioProps = {
  photos: PortfolioPhoto[];
  totalCount: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  isSelf?: boolean;
  isReady?: boolean;
};

// 실제 표시 비율에 맞는 Masonry 계산용 크기 반환
function getMasonrySize(photo: PortfolioPhoto) {
  // 이미지가 없으면 임시 배경 비율 사용
  if (!photo.imageUrl) {
    return { width: 4, height: 5 };
  }

  // 지정한 표시 비율을 가로·세로 값으로 변환
  const ratioValues = photo.displayAspectRatio?.split('/').map(Number) ?? [];
  const [width = 0, height = 1] = ratioValues;

  if (
    ratioValues.length <= 2 &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return { width, height };
  }

  // 유효한 표시 비율이 없으면 원본 크기 사용
  return { width: photo.width, height: photo.height };
}

export default function PhotographerPortfolio({
  photos,
  totalCount,
  hasNextPage,
  isFetchingNextPage = false,
  onLoadMore,
  isSelf = false,
  isReady = true,
}: PhotographerPortfolioProps) {
  // 원본 사진과 배치용 크기를 함께 구성
  const masonryPhotos = photos.map((photo, index) => ({
    photo,
    imageIndex: index + 1,
    ...getMasonrySize(photo),
  }));

  return (
    <section
      id="portfolio"
      aria-labelledby="portfolio-title"
      className={styles.portfolio}
    >
      {/* 포트폴리오 제목 표시 */}
      <h2 id="portfolio-title" className={styles.title}>
        포트폴리오
      </h2>

      {/* 사진이 없는 경우 본인 미설정 상태와 공개 상태를 구분함 */}
      {photos.length === 0 ? (
        isSelf && !isReady ? (
          // 작가 본인 미설정 상태의 포트폴리오 등록 안내
          <div className={styles.emptyStateOwn}>
            <p className={styles.emptyStateOwnTitle}>아직 올린 사진이 없어요</p>
            <p className={styles.emptyStateOwnDescription}>
              포트폴리오를 3장 이상 등록해 주세요
            </p>
          </div>
        ) : (
          // 공개 프로필에서는 기존 빈 상태 안내를 유지함
          <p className={styles.emptyState}>
            아직 등록된 포트폴리오가 없습니다.
          </p>
        )
      ) : (
        <>
          {/* 공통 Masonry로 사진 목록 배치 */}
          <Masonry
            items={masonryPhotos}
            desktopColumns={4}
            gap={16}
            ariaLabel="포트폴리오 사진 목록"
            getKey={({ photo }) => photo.photoId}
            renderItem={({ photo, imageIndex, width, height }) => (
              <div className={styles.photoItem}>
                {photo.imageUrl ? (
                  <Image
                    src={photo.imageUrl}
                    alt={`포트폴리오 사진 ${imageIndex}`}
                    width={photo.width}
                    height={photo.height}
                    sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 25vw"
                    className={styles.photoImage}
                    style={{ aspectRatio: `${width} / ${height}` }}
                  />
                ) : (
                  // 이미지가 없는 경우 임시 배경 표시
                  <div
                    className={styles.placeholder}
                    role="img"
                    aria-label={`포트폴리오 예시 사진 ${imageIndex}`}
                  />
                )}
              </div>
            )}
          />

          {/* 다음 사진 페이지가 있는 경우 더 보기 버튼 표시 */}
          {(hasNextPage ?? totalCount > photos.length) && (
            <div className={styles.moreButton}>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={onLoadMore}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage
                  ? '사진을 불러오는 중이에요...'
                  : '포트폴리오 더 보기'}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
