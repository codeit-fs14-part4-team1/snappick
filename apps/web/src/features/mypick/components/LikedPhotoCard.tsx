'use client';

import { usePhotoLikeAction } from '@/features/photos/hooks/usePhotoLikeAction';
import type { LikedPhoto } from '../types';
import Image from 'next/image';
import styles from './LikedPhotoCard.module.css';
import HeartIcon from '@/components/ui/HeartIcon';

export default function LikedPhotoCard({ photo }: { photo: LikedPhoto }) {
  const liked = photo.liked ?? true;
  const { handleLikeClick } = usePhotoLikeAction({
    photoId: photo.photoId,
    liked,
  });

  return (
    <article
      className={`${styles.card} ${liked === false ? styles.unliked : ''}`}
    >
      <Image
        src={photo.imageUrl}
        alt={`${photo.photographer.nickname}의 사진`}
        width={photo.width}
        height={photo.height}
        sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 20vw "
        className={styles.image}
      />
      <div className={styles.overlay}>
        <button
          type="button"
          className={styles.like}
          aria-pressed={liked}
          aria-label={`${photo.photographer.nickname}의 사진 좋아요`}
          onClick={handleLikeClick}
        >
          <HeartIcon filled={liked} className={styles.heart} />
          {liked && (
            <span className={styles.cancelText} aria-hidden="true">
              취소
            </span>
          )}
        </button>
      </div>
    </article>
  );
}
