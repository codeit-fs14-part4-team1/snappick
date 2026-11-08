'use client';

//InfiniteScrollTrigger: 목록 끝에 닿으면 다음 페이지 요청
import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import styles from './InfiniteScrollTrigger.module.css';

export type InfiniteScrollTriggerProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  onLoadMore: () => void;
};

//컴포넌트 정의
export default function InfiniteScrollTrigger({
  hasNextPage,
  isFetchingNextPage,
  isError,
  onLoadMore,
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
        rootMargin: '100px 0px',
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isFetchingNextPage, hasNextPage, isError, onLoadMore]);

  if (isError) {
    return (
      <div role="alert" className={styles.message}>
        <p>내용을 불러오지 못했어요</p>
        <Button variant="outline" onClick={() => onLoadMore()}>
          다시 시도
        </Button>
      </div>
    );
  }
  return (
    <div ref={targetRef} className={styles.message}>
      {isFetchingNextPage && <p role="status">내용을 더 불러오는 중이에요</p>}
      {!hasNextPage && <p role="status">내용을 모두 불러왔어요</p>}
    </div>
  );
}
