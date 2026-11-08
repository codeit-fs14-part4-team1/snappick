'use client';

import Image from 'next/image';
import type { FeedPhoto } from '../types';
import styles from './FeedCard.module.css';
import HeartIcon from '@/components/ui/HeartIcon';
import { getViewerKind } from '../viewerKind';
import { useAuth } from '@/features/auth/context/AuthContext';
import { usePhotoLike } from '../hooks/usePhotoLike';
import { useGuestLoginModal } from '@/components/ui/GuestLoginProvider';

type FeedCardProps = {
  photo: FeedPhoto;
  onOpen: (id: string) => void;
};

export default function FeedCard({ photo, onOpen }: FeedCardProps) {
  const { authStatus, user } = useAuth();
  const { openGuestLoginModal } = useGuestLoginModal();
  const { toggleLike } = usePhotoLike(photo);
  const viewerKind = getViewerKind(authStatus, user);

  function handleLikeClick() {
    if (viewerKind === 'pending') return;
    if (viewerKind === 'guest') {
      openGuestLoginModal();
      return;
    }
    if (viewerKind === 'user') toggleLike();
  }

  return (
    <article className={styles.card}>
      <Image
        src={photo.imageUrl}
        alt={`${photo.photographer.nickname}의 사진`}
        width={photo.width}
        height={photo.height}
        sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 20vw "
        className={styles.image}
      />
      <button
        type="button"
        className={styles.open}
        aria-label={`${photo.photographer.nickname}의 사진 자세히 보기`}
        onClick={() => onOpen(photo.photoId)}
      />
      <div className={styles.overlay}>
        {viewerKind === 'photographer' ? (
          <span
            className={styles.likeText}
            role="img"
            aria-label={`좋아요 ${photo.likeCount}개`}
          >
            <HeartIcon filled className={styles.heart} />
            <span className={styles.count}>{photo.likeCount}</span>
          </span>
        ) : (
          <button
            type="button"
            className={styles.like}
            aria-pressed={viewerKind === 'user' ? photo.liked : undefined}
            aria-disabled={viewerKind === 'pending' ? true : undefined}
            aria-label={`좋아요 ${photo.likeCount}개`}
            onClick={handleLikeClick}
          >
            <HeartIcon filled={photo.liked} className={styles.heart} />
            <span className={styles.count}>{photo.likeCount}</span>
          </button>
        )}
        <div className={styles.author}>
          <span className={styles.avatar} aria-hidden="true" />
          <span className={styles.nickname}>{photo.photographer.nickname}</span>
        </div>
      </div>
    </article>
  );
}
