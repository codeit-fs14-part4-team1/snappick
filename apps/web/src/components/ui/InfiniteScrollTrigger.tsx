'use client';

//InfiniteScrollTrigger: 목록 끝에 닿으면 다음 페이지 요청
import { useEffect, useRef, type RefObject } from 'react';
import Button from '@/components/ui/Button';
import styles from './InfiniteScrollTrigger.module.css';

export type InfiniteScrollTriggerProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  onLoadMore: () => void;
  //스크롤 기준 상자 (사진 관리 썸네일용)
  root?: RefObject<HTMLElement | null>;
  //좁은 목록용 (끝 안내 생략)
  compact?: boolean;
};

//컴포넌트 정의
export default function InfiniteScrollTrigger({
  hasNextPage,
  isFetchingNextPage,
  isError,
  onLoadMore,
  root,
  compact = false,
}: InfiniteScrollTriggerProps) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !hasNextPage || isFetchingNextPage || isError) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      {
        root: root?.current ?? null,
        //상자 안은 가로 스크롤도 감지
        rootMargin: root ? '100px' : '100px 0px',
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isFetchingNextPage, hasNextPage, isError, onLoadMore, root]);

  const className = compact
    ? `${styles.message} ${styles.compact}`
    : styles.message;

  if (isError) {
    return (
      <div role="alert" className={className}>
        <p>{compact ? '불러오지 못했어요' : '내용을 불러오지 못했어요'}</p>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'md'}
          onClick={() => onLoadMore()}
        >
          다시 시도
        </Button>
      </div>
    );
  }
  return (
    <div ref={targetRef} className={className}>
      {isFetchingNextPage && (
        <p role="status">
          {compact ? '불러오는 중…' : '내용을 더 불러오는 중이에요'}
        </p>
      )}
      {!hasNextPage && !compact && <p role="status">내용을 모두 불러왔어요</p>}
    </div>
  );
}
