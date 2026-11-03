'use client';

import { useExploreFeed } from '../hooks/useExploreFeed';
import FeedList from './FeedList';

export default function FeedView() {
  const { data, status, refetch } = useExploreFeed({});

  const photos = data?.pages.flatMap((page) => page.items) ?? [];

  return <FeedList photos={photos} status={status} onRetry={() => refetch()} />;
}
