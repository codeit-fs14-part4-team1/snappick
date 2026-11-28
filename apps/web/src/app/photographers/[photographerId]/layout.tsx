import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import type { PhotographerProfile } from '@/features/profile/types';

const SITE_NAME = 'SnapPick';
const DEFAULT_TITLE = `사진작가 프로필 | ${SITE_NAME}`;
const DEFAULT_DESCRIPTION =
  '원하는 사진 스타일을 탐색하고 사진작가와 연결되는 이미지 기반 스냅 촬영 매칭 서비스';
const DESCRIPTION_MAX_LENGTH = 80;
// 공유 미리보기는 자주 바뀌지 않으므로 같은 작가 조회는 잠시 재사용한다
const PROFILE_REVALIDATE_SECONDS = 60;

type Params = Promise<{ photographerId: string }>;
type ProfilePreview = Pick<
  PhotographerProfile,
  'nickname' | 'introduction' | 'profileImageUrl' | 'isReady'
>;

// 링크 미리보기 수집기는 로그인하지 않으므로 비회원 기준으로 조회한다
async function fetchProfilePreview(
  photographerId: string,
): Promise<ProfilePreview | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) return null;

  try {
    const response = await fetch(
      `${baseUrl}/photographers/${encodeURIComponent(photographerId)}`,
      { next: { revalidate: PROFILE_REVALIDATE_SECONDS } },
    );
    if (!response.ok) return null;
    return (await response.json()) as ProfilePreview;
  } catch {
    // 미리보기 정보를 못 가져와도 페이지는 열려야 하므로 기본값을 쓴다
    return null;
  }
}

// 요청이 들어온 주소로 공유 URL의 기준(origin)을 정한다
async function requestOrigin(): Promise<URL | undefined> {
  const headerList = await headers();
  // 프록시를 여러 번 거치면 "a, b"처럼 오므로 첫 값(사용자가 연 주소)을 쓴다
  const first = (name: string) =>
    headerList.get(name)?.split(',')[0]?.trim() || undefined;
  const host = first('x-forwarded-host') ?? first('host');
  if (!host) return undefined;
  const protocol =
    first('x-forwarded-proto') ??
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');
  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return undefined;
  }
}

function toDescription(introduction: string | null): string {
  const text = introduction?.replace(/\s+/g, ' ').trim();
  if (!text) return DEFAULT_DESCRIPTION;
  return text.length > DESCRIPTION_MAX_LENGTH
    ? `${text.slice(0, DESCRIPTION_MAX_LENGTH)}…`
    : text;
}

// 카카오톡 등 링크 미리보기에 쓰이는 작가별 제목·설명·이미지 (페이지는 클라이언트 컴포넌트라 여기서 만든다)
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { photographerId } = await params;
  const [profile, origin] = await Promise.all([
    fetchProfilePreview(photographerId),
    requestOrigin(),
  ]);
  const path = `/photographers/${photographerId}`;

  // 조회 실패·준비 중인 작가는 작가 정보를 노출하지 않고 기본값을 쓴다
  if (!profile || !profile.isReady) {
    return {
      metadataBase: origin,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      openGraph: {
        type: 'website',
        siteName: SITE_NAME,
        url: path,
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
      },
    };
  }

  const title = `${profile.nickname} | ${SITE_NAME}`;
  const description = toDescription(profile.introduction);
  const image = profile.profileImageUrl;

  return {
    metadataBase: origin,
    title,
    description,
    openGraph: {
      type: 'profile',
      siteName: SITE_NAME,
      url: path,
      title,
      description,
      ...(image && {
        images: [{ url: image, alt: `${profile.nickname} 프로필 이미지` }],
      }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image && { images: [image] }),
    },
  };
}

export default function PhotographerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
