'use client';

import { useExploreFeed } from '../hooks/useExploreFeed';
import FeedList from './FeedList';

export default function FeedView() {
  const {
    data,
    status,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useExploreFeed({});

  //사진 items 평탄화해서 배열로 정의 + 페이지 사이 중복 가능성 제거(offset 커서 방어)
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
