//InfiniteScrollTrigger: 목록 끝에 닿으면 다음 페이지 요청
import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import styles from './InfiniteScrollTrigger.module.css';

//props (FeedView → FeedList → 전달): hasNextPage, isFetchingNextPage, isError, onLoadMore
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
  //감지 대상 div를 가리킬 ref
  const targetRef = useRef<HTMLDivElement>(null);

  //렌더링 후 Observer 등록 (부수 효과)
  useEffect(() => {
    const target = targetRef.current;
    //  등록 안 함: ref 없음 / 마지막 페이지 / 요청 중(중복 방지) / 실패
    if (!target || !hasNextPage || isFetchingNextPage || isError) return;

    //  목록 끝 감지 → onLoadMore 호출 (바닥 100px 전에 미리)
    //callback인자 entries(관찰대상과 교차상태 변경), observer(관찰자) - 대상이 하나라 첫번째만 사용
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      {
        rootMargin: '100px 0px',
      },
    );
    observer.observe(target);
    //  cleanup: 이전 Observer 해제 (안 하면 쌓여서 중복 요청)
    return () => observer.disconnect();
    //  의존값이 바뀌면 재등록 → 아직 화면 안이면 바로 다음 요청 (화면이 덜 찼을 때 멈춤 방지)
  }, [isFetchingNextPage, hasNextPage, isError, onLoadMore]);

  //화면 (분기는 useEffect 아래: 훅 순서 규칙)
  //  실패 → 문구 + 재시도 버튼 (자동 재시도 안 함: 실패 반복 방지)
  if (isError) {
    return (
      <div role="alert" className={styles.message}>
        <p>사진을 더 불러오지 못했어요.</p>
        <Button variant="outline" onClick={() => onLoadMore()}>
          다시 시도
        </Button>
      </div>
    );
  }
  //  그 외 → 감지용 div (로딩 중이면 문구, 종료면 비어 있음)
  return (
    <div ref={targetRef} className={styles.message}>
      {isFetchingNextPage && <p role="status">사진을 더 불러오는 중이에요.</p>}
      {!hasNextPage && <p role="status">사진을 모두 불러왔어요.</p>}
    </div>
  );
}
