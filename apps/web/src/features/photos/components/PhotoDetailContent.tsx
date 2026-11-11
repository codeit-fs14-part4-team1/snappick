//사진 상세 내용: 조회·상태 분기는 PhotoDetailModal, 여기는 받은 photo 표시 + 좋아요

import Image from 'next/image';
import Link from 'next/link';
import { CategoryLabel, StyleLabel } from '@/constants/enum-labels';
import type { PhotoDetail } from '../types';
import type { CSSProperties } from 'react';
import styles from './PhotoDetailContent.module.css';
import HeartIcon from '@/components/ui/HeartIcon';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useGuestLoginModal } from '@/components/ui/GuestLoginProvider';
import { usePhotoLike } from '../hooks/usePhotoLike';
import { getViewerKind } from '@/features/feed/viewerKind';
import PhotoShareButton from './PhotoShareButton';

type PhotoDetailContentProps = {
  photo: PhotoDetail;
  getShareUrl?: (photoId: string) => string;
};

export default function PhotoDetailContent({
  photo,
  getShareUrl,
}: PhotoDetailContentProps) {
  const { photographer } = photo;
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
    <div className={styles.content}>
      <div className={styles.imageArea}>
        <Image
          src={photo.imageUrl}
          alt={`${photographer.nickname}의 사진`}
          width={photo.width}
          height={photo.height}
          sizes="(max-width: 1199px) 100vw, 50vw"
          className={styles.image}
          style={
            { '--photo-ratio': photo.width / photo.height } as CSSProperties
          }
        />
      </div>

      <div className={styles.info}>
        <div className={styles.summary}>
          <header>
            <ul className={styles.categories}>
              {photo.categories.map((category) => (
                <li key={category} className={styles.category}>
                  {CategoryLabel[category]}
                </li>
              ))}
            </ul>
            {photo.description && (
              <p className={styles.description}>{photo.description}</p>
            )}
          </header>
          {photo.styles.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>스타일</h3>
              <ul className={styles.chips}>
                {photo.styles.map((style) => (
                  <li key={style} className={styles.styleChip}>
                    #{StyleLabel[style]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {photo.keywords.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>키워드</h3>
              <ul className={styles.chips}>
                {photo.keywords.map((keyword) => (
                  <li key={keyword} className={styles.keywordChip}>
                    {keyword}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* 좋아요: 정책은 FeedCard와 같음 (작가는 읽기 전용, 비회원은 로그인 안내) */}
          <div className={styles.actions}>
            {viewerKind === 'photographer' ? (
              <span
                className={styles.like}
                role="img"
                aria-label={`좋아요 ${photo.likeCount}개`}
              >
                <HeartIcon filled className={styles.heart} />
                <span>{photo.likeCount}</span>
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
                <span>{photo.likeCount}</span>
              </button>
            )}
            {getShareUrl && (
              <PhotoShareButton
                photoId={photo.photoId}
                getShareUrl={getShareUrl}
                className={styles.share}
              />
            )}
          </div>
        </div>
        <Link
          href={`/photographers/${photographer.id}`}
          className={styles.photographer}
        >
          {photographer.profileImageUrl ? (
            <Image
              src={photographer.profileImageUrl}
              width={48}
              height={48}
              alt=""
              unoptimized
              className={styles.avatar}
            />
          ) : (
            <span aria-hidden="true" className={styles.avatarPlaceholder}>
              {photographer.nickname.charAt(0)}
            </span>
          )}
          <div className={styles.photographerText}>
            <p className={styles.nickname}>{photographer.nickname}</p>
            <p className={styles.rating}>
              ★{' '}
              {photographer.ratingAvg === null
                ? '—'
                : photographer.ratingAvg.toFixed(1)}{' '}
              (리뷰 {photographer.reviewCount})
            </p>
          </div>
          <span aria-hidden="true" className={styles.arrow}>
            ›
          </span>
        </Link>
      </div>
    </div>
  );
}
