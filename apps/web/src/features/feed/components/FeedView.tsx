'use client';

import { useExploreParams } from '../hooks/useExploreParams';
import { useExploreFeed } from '../hooks/useExploreFeed';

import FeedList from './FeedList';
import FilterBar from './FilterBar';
import { useState } from 'react';
import PhotoDetailModal from '@/features/photos/components/PhotoDetailModal';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function FeedView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const photoId = searchParams.get('photoId');
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

  //null : 모달이 닫힘
  function pushPhotoId(next: string | null) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('photoId', next);
    else params.delete('photoId');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }
  const openPhoto = (id: string) => pushPhotoId(id);
  const closePhoto = () => pushPhotoId(null);

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
        onOpenPhoto={openPhoto}
      />
      <PhotoDetailModal
        photoId={photoId}
        onClose={closePhoto}
        onSelectPhoto={openPhoto}
      />
    </>
  );
}
