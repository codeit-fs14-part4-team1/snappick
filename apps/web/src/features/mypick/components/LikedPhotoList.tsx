'use client';

import InfiniteScrollTrigger from '@/components/ui/InfiniteScrollTrigger';
import Masonry from '@/components/ui/Masonry';
import { useLikedPhotos } from '../hooks/useLikedPhotos';
import StateMessage from '@/components/ui/StateMessage';
import LikedPhotoCard from './LikedPhotoCard';

export default function LikedPhotoList() {
  const {
    data,
    isPending,
    isError,
    isFetchNextPageError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useLikedPhotos();

  const seen = new Set<string>();
  const photos = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (photo) => {
      if (seen.has(photo.photoId)) return false;
      seen.add(photo.photoId);
      return true;
    },
  );

  if (isPending) {
    return <StateMessage title="사진을 불러오는 중입니다..." role="status" />;
  }

  if (isError && !data) {
    return (
      <StateMessage
        title="사진을 불러오는 데 실패했습니다."
        button={{
          label: '다시 시도',
          onClick: () => refetch(),
        }}
        role="alert"
      />
    );
  }
  if (photos.length === 0) {
    return (
      <StateMessage
        title="아직 좋아요한 사진이 없어요."
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
      <Masonry
        items={photos}
        desktopColumns={5}
        gap={{ desktop: 16 }}
        ariaLabel="좋아요한 사진 목록"
        getKey={(photo) => photo.photoId}
        renderItem={(photo) => <LikedPhotoCard photo={photo} />}
      />
      <InfiniteScrollTrigger
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isError={isFetchNextPageError}
        onLoadMore={fetchNextPage}
      />
    </>
  );
}
