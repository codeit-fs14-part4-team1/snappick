'use client';

import { useExploreParams } from '../hooks/useExploreParams';
import { useExploreFeed } from '../hooks/useExploreFeed';

import FeedList from './FeedList';
import FilterBar from './FilterBar';
import { useState } from 'react';

export default function FeedView() {
  const [resetCount, setResetCount] = useState(0);
  const { filters, setFilters, resetAll } = useExploreParams();
  const {
    data,
    status,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useExploreFeed(filters);

  const seen = new Set<string>();
  const photos = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (photo) => {
      if (seen.has(photo.photoId)) return false;
      seen.add(photo.photoId);
      return true;
    },
  );
  const totalCount = data?.pages[0]?.totalCount.toLocaleString('ko-KR');

  function handleReset() {
    setResetCount((n) => n + 1);
    resetAll();
  }

  return (
    <>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        totalCount={totalCount}
        onReset={handleReset}
        resetCount={resetCount}
      />
      <FeedList
        photos={photos}
        status={status}
        onRetry={() => refetch()}
        onReset={handleReset}
        pagination={{
          hasNextPage,
          isFetchingNextPage,
          isError: isFetchNextPageError,
          onLoadMore: fetchNextPage,
        }}
      />
    </>
  );
}
