'use client';

import { useExploreParams } from '../hooks/useExploreParams';
import { useExploreFeed } from '../hooks/useExploreFeed';

import FeedList from './FeedList';

export default function FeedView() {
  const { filters } = useExploreParams();
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

  return (
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
  );
}
