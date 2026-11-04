//피드 화면 상태

import Button from '@/components/ui/Button';
import type { FeedPhoto } from '../types';
import styles from './FeedList.module.css';
import InfiniteScrollTrigger, {
  type InfiniteScrollTriggerProps,
} from './InfiniteScrollTrigger';
import FeedMasonry from './FeedMasonry';

//FeedList가 받는 Props
type FeedListProps = {
  photos: FeedPhoto[];
  status: 'pending' | 'error' | 'success';
  onRetry: () => void;
  pagination: InfiniteScrollTriggerProps;
};

//상태별 분기
export default function FeedList({
  photos,
  status,
  onRetry,
  pagination,
}: FeedListProps) {
  //첫 페이지
  if (status === 'pending') {
    return (
      <p role="status" className={styles.message}>
        사진을 불러오는 중이에요.
      </p>
    );
  }

  //보여줄 사진이 없을 때
  if (status === 'error' && photos.length === 0) {
    return (
      <div role="alert" className={styles.message}>
        <p>사진을 불러오지 못했어요.</p>
        <Button variant="outline" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    );
  }

  //조회결과가 없을 때
  if (photos.length === 0) {
    return <p className={styles.message}>조건에 맞는 사진이 없어요.</p>;
  }

  return (
    <>
      <FeedMasonry photos={photos} />
      <InfiniteScrollTrigger {...pagination} />
    </>
  );
}
