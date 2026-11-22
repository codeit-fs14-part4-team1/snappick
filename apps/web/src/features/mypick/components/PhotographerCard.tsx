'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CategoryLabel } from '@/constants/enum-labels';
import { useToast } from '@/components/ui/ToastProvider';
import { useTogglePhotographerSave } from '@/features/profile/hooks/useTogglePhotographerSave';
import type { SavedPhotographer } from '../types';
import styles from './PhotographerCard.module.css';

//저장한 작가 카드: 커버(없으면 빈 배경) · 아바타 · 닉네임 · 카테고리 칩
//카드 클릭: 작가 페이지로 이동 (Link가 카드 전체를 덮음, 저장 버튼은 Link 밖 형제)
//저장 해제: useTogglePhotographerSave, 성공하면 photographers.all 무효화로 목록에서 빠짐
export default function PhotographerCard({
  photographer,
}: {
  photographer: SavedPhotographer;
}) {
  const { photographerId, nickname, profileImageUrl, coverImageUrl } =
    photographer;
  const { showToast } = useToast();
  const saveMutation = useTogglePhotographerSave();

  function handleUnsaveClick() {
    if (saveMutation.isPending) return;
    saveMutation.mutate(
      { photographerId, saved: true },
      {
        onError: () => showToast('작가 저장 취소에 실패했어요.', 'error'),
      },
    );
  }

  return (
    <article className={styles.card}>
      <Link
        href={`/photographers/${photographerId}`}
        className={styles.link}
        aria-label={`${nickname} 작가 페이지`}
      >
        <div className={styles.cover}>
          {coverImageUrl && (
            <Image
              src={coverImageUrl}
              alt=""
              fill
              sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 25vw"
              className={styles.coverImage}
            />
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.profile}>
            <span className={styles.avatar}>
              {profileImageUrl && (
                <Image
                  src={profileImageUrl}
                  alt=""
                  fill
                  sizes="32px"
                  className={styles.avatarImage}
                />
              )}
            </span>
            <span className={styles.nickname}>{nickname}</span>
          </div>
          {photographer.categories.length > 0 && (
            <ul className={styles.categories}>
              {photographer.categories.map((category) => (
                <li key={category} className={styles.chip}>
                  {CategoryLabel[category]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
      <button
        type="button"
        className={styles.save}
        aria-label={`${nickname} 작가 저장`}
        aria-pressed={true}
        disabled={saveMutation.isPending}
        onClick={handleUnsaveClick}
      >
        <svg
          viewBox="0 0 10 14"
          width={10}
          height={14}
          aria-hidden="true"
          focusable="false"
          className={styles.bookmark}
        >
          <path d="M0 0H10V14L5 10.5L0 14V0Z" fill="currentColor" />
        </svg>
        <span className={styles.cancelText} aria-hidden="true">
          취소
        </span>
      </button>
    </article>
  );
}
