'use client';

import InfiniteScrollTrigger from '@/components/ui/InfiniteScrollTrigger';
import StateMessage from '@/components/ui/StateMessage';
import { useSavedPhotographers } from '../hooks/useSavedPhotographers';
import PhotographerCard from './PhotographerCard';
import styles from './SavedPhotographerList.module.css';

export default function SavedPhotographerList() {
  const {
    data,
    isPending,
    isError,
    isFetchNextPageError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useSavedPhotographers();

  const seen = new Set<string>();
  const photographers = (
    data?.pages.flatMap((page) => page.items) ?? []
  ).filter((photographer) => {
    if (seen.has(photographer.photographerId)) return false;
    seen.add(photographer.photographerId);
    return true;
  });

  if (isPending) {
    return <StateMessage title="작가를 불러오는 중입니다..." role="status" />;
  }

  //에러
  if (isError && !data) {
    return (
      <StateMessage
        title="작가를 불러오는 데 실패했습니다."
        button={{
          label: '다시 시도',
          onClick: () => refetch(),
        }}
        role="alert"
      />
    );
  }

  if (photographers.length === 0) {
    return (
      <StateMessage
        title="아직 저장한 작가가 없어요."
        link={{
          label: '사진 보러가기',
          href: '/',
        }}
        role="status"
      />
    );
  }

  return (
    <>
      <ul className={styles.grid} aria-label="저장한 작가 목록">
        {photographers.map((photographer) => (
          <li key={photographer.photographerId}>
            <PhotographerCard photographer={photographer} />
          </li>
        ))}
      </ul>
      <InfiniteScrollTrigger
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isError={isFetchNextPageError}
        onLoadMore={fetchNextPage}
      />
    </>
  );
}
