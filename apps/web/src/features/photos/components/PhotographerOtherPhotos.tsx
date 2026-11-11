import InfiniteScrollTrigger from '@/components/ui/InfiniteScrollTrigger';
import Masonry from '@/components/ui/Masonry';
import { usePhotographerPhotos } from '../hooks/usePhotographerPhotos';
import Image from 'next/image';
import styles from './PhotographerOtherPhotos.module.css';

type PhotographerOtherPhotosProps = {
  photographerId: string;
  excludePhotoId: string;
  onSelectPhoto: (photoId: string) => void;
};

export default function PhotographerOtherPhotos({
  photographerId,
  excludePhotoId,
  onSelectPhoto,
}: PhotographerOtherPhotosProps) {
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = usePhotographerPhotos(photographerId, {
    excludePhotoId,
    limit: 8,
  });
  const seen = new Set<string>();
  const photos = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (photo) => {
      if (seen.has(photo.photoId)) return false;
      seen.add(photo.photoId);
      return true;
    },
  );
  if (photos.length === 0) return null;
  return (
    <section className={styles.section}>
      <h3 className={styles.title}>작가의 다른 사진</h3>
      <Masonry
        items={photos}
        desktopColumns={4}
        gap={{ desktop: 16, tablet: 8 }}
        ariaLabel="작가의 다른 사진"
        getKey={(photo) => photo.photoId}
        renderItem={(photo) => (
          <button
            type="button"
            className={styles.card}
            onClick={() => onSelectPhoto(photo.photoId)}
            aria-label="이 사진 보기"
          >
            <Image
              src={photo.imageUrl}
              alt=""
              width={photo.width}
              height={photo.height}
              sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 300px"
              className={styles.image}
            />
          </button>
        )}
      />
      <InfiniteScrollTrigger
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isError={isFetchNextPageError}
        onLoadMore={fetchNextPage}
      />
    </section>
  );
}
