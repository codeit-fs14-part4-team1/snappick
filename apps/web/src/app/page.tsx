import type { Metadata } from 'next';
import PageContainer from '@/components/layout/PageContainer';
import FeedView from '@/features/feed/components/FeedView';
import ReviewPrompt from '@/features/my/reviews/ReviewPrompt';
import type { PhotoDetail } from '@/features/photos/types';
import {
  buildShareMetadata,
  fetchPublicPreview,
  toPreviewDescription,
} from '@/lib/shareMetadata';
import { Suspense } from 'react';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type PhotoPreview = Pick<
  PhotoDetail,
  'imageUrl' | 'description' | 'photographer'
>;

// 사진 공유 링크(/?photoId=)는 그 사진으로, 그 밖에는 사이트 기본값으로 미리보기를 만든다
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { photoId } = await searchParams;
  if (typeof photoId !== 'string' || !photoId) {
    return buildShareMetadata({ path: '/' });
  }

  const path = `/?photoId=${encodeURIComponent(photoId)}`;
  const photo = await fetchPublicPreview<PhotoPreview>(
    `/photos/${encodeURIComponent(photoId)}`,
  );
  // 없는 사진·조회 실패는 사진 정보 없이 기본값을 쓴다
  if (!photo) return buildShareMetadata({ path });

  const nickname = photo.photographer.nickname;

  // 미리보기는 제목·한줄 설명·이미지만 쓴다 (한줄 설명이 없으면 사이트 설명)
  return buildShareMetadata({
    title: `${nickname}의 사진`,
    description: toPreviewDescription(photo.description),
    path,
    type: 'article',
    // 대체 텍스트는 사진을 묘사하는 한줄 설명을 쓰고, 없으면 누구의 사진인지만 적는다
    image: {
      url: photo.imageUrl,
      alt: photo.description?.trim() || `${nickname}의 사진`,
    },
  });
}

export default function Home() {
  return (
    <PageContainer width="wide">
      <ReviewPrompt />
      <Suspense fallback={<p role="status">사진을 불러오는 중이에요.</p>}>
        <FeedView />
      </Suspense>
    </PageContainer>
  );
}
