'use client';

import { useExploreParams } from '../hooks/useExploreParams';
import { useExploreFeed } from '../hooks/useExploreFeed';

import FeedList from './FeedList';
import FilterBar from './FilterBar';

export default function FeedView() {
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

  return (
    <>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        totalCount={totalCount}
        onReset={resetAll}
      />
      <FeedList
        photos={photos}
        status={status}
        onRetry={() => refetch()}
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
