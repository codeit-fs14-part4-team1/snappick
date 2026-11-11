'use client';

import Button from '@/components/ui/Button';
import styles from './PhotographerPreparing.module.css';

type PhotographerPreparingProps = {
  onExplore: () => void;
};

// 외부 방문자에게 프로필 준비 중 안내 화면을 표시함
export default function PhotographerPreparing({
  onExplore,
}: PhotographerPreparingProps) {
  return (
    <section
      className={styles.preparing}
      aria-labelledby="photographer-preparing-title"
    >
      {/* 프로필 준비 중 안내 제목 */}
      <h1 id="photographer-preparing-title" className={styles.title}>
        준비 중인 작가예요
      </h1>

      {/* 프로필 준비 중 안내 설명 */}
      <p className={styles.description}>
        작가님이 프로필을 준비하고 있어요.
        <br />
        다른 작가의 사진을 둘러보세요.
      </p>

      {/* 사진 탐색 페이지 이동 버튼 */}
      <div className={styles.action}>
        <Button variant="primary" size="lg" fullWidth onClick={onExplore}>
          탐색으로 가기
        </Button>
      </div>
    </section>
  );
}
