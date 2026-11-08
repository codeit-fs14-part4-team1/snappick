//사진 상세 표시 전용: 조회·상태 분기는 PhotoDetailModal, 여기는 받은 photo를 그리기만

import Image from 'next/image';
import Link from 'next/link';
import { CategoryLabel, StyleLabel } from '@/constants/enum-labels';
import type { PhotoDetail } from '../types';
import styles from './PhotoDetailContent.module.css';
import type { CSSProperties } from 'react';

type PhotoDetailContentProps = {
  photo: PhotoDetail;
};

export default function PhotoDetailContent({ photo }: PhotoDetailContentProps) {
  const { photographer } = photo;

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
          {/* 좋아요 · 공유: #127에서 (지금은 자리만) */}
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
