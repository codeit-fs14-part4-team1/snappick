import Image from 'next/image';
import Button from '@/components/ui/Button';
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
};

export default function PhotographerPortfolio({
  photos,
  totalCount,
}: PhotographerPortfolioProps) {
  // 데스크톱 기준 사진 열 개수 정의
  const columnCount = 4;

  // 사진 수에 따라 각 열에 배치할 사진 개수 계산
  const photosPerColumn = Math.ceil(photos.length / columnCount);

  // 사진 목록을 열 단위로 분리함
  const photoColumns = Array.from({ length: columnCount }, (_, columnIndex) =>
    photos.slice(
      columnIndex * photosPerColumn,
      (columnIndex + 1) * photosPerColumn,
    ),
  ).filter((column) => column.length > 0);

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

      {photos.length === 0 ? (
        // 등록된 사진이 없는 경우 안내 문구 표시
        <p className={styles.emptyState}>아직 등록된 포트폴리오가 없습니다.</p>
      ) : (
        <>
          {/* 포트폴리오 사진을 열 단위로 배치 */}
          <div className={styles.photoList}>
            {photoColumns.map((column, columnIndex) => (
              <ul key={columnIndex} className={styles.photoColumn}>
                {column.map((photo, photoIndex) => {
                  // 전체 사진 목록에서의 순서 계산
                  const imageIndex =
                    columnIndex * photosPerColumn + photoIndex + 1;

                  return (
                    <li key={photo.photoId} className={styles.photoItem}>
                      {photo.imageUrl ? (
                        <Image
                          src={photo.imageUrl}
                          alt={`포트폴리오 사진 ${imageIndex}`}
                          width={photo.width}
                          height={photo.height}
                          sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 25vw"
                          className={styles.photoImage}
                          // 표시 비율이 지정된 경우 썸네일 영역에 맞춰 이미지 자르기
                          style={
                            photo.displayAspectRatio
                              ? {
                                  aspectRatio: photo.displayAspectRatio,
                                  objectFit: 'cover',
                                }
                              : undefined
                          }
                        />
                      ) : (
                        // 이미지가 없는 경우 임시 배경 표시
                        <div
                          className={styles.placeholder}
                          role="img"
                          aria-label={`포트폴리오 예시 사진 ${imageIndex}`}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>

          {/* 추가 사진이 있는 경우 더 보기 버튼 표시 */}
          {totalCount > photos.length && (
            <div className={styles.moreButton}>
              <Button variant="outline" fullWidth>
                포트폴리오 더 보기
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
