import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { PhotographerProfile } from '@/features/profile/types';
import {
  buildShareMetadata,
  fetchPublicPreview,
  toPreviewDescription,
} from '@/lib/shareMetadata';

type Params = Promise<{ photographerId: string }>;
type ProfilePreview = Pick<
  PhotographerProfile,
  'nickname' | 'introduction' | 'profileImageUrl' | 'isReady'
>;

// 카카오톡 등 링크 미리보기에 쓰이는 작가별 제목·설명·이미지 (페이지는 클라이언트 컴포넌트라 여기서 만든다)
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { photographerId } = await params;
  const path = `/photographers/${photographerId}`;
  const profile = await fetchPublicPreview<ProfilePreview>(
    `/photographers/${encodeURIComponent(photographerId)}`,
  );

  // 조회 실패·준비 중인 작가는 작가 정보를 노출하지 않고 기본값을 쓴다
  if (!profile || !profile.isReady) {
    return buildShareMetadata({ title: '사진작가 프로필', path });
  }

  return buildShareMetadata({
    title: profile.nickname,
    description: toPreviewDescription(profile.introduction),
    path,
    type: 'profile',
    image: profile.profileImageUrl
      ? {
          url: profile.profileImageUrl,
          alt: `${profile.nickname} 프로필 이미지`,
        }
      : null,
  });
}

export default function PhotographerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
