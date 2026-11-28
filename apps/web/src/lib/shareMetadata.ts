// 카카오톡 등 링크 미리보기(Open Graph)용 메타데이터를 서버에서 만들 때 쓰는 공통 함수
// 서버 컴포넌트의 generateMetadata에서만 사용한다 (next/headers 사용)
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export const SITE_NAME = 'SnapPick';
export const SITE_DESCRIPTION =
  '원하는 사진 스타일을 탐색하고 사진작가와 연결되는 이미지 기반 스냅 촬영 매칭 서비스';

const DESCRIPTION_MAX_LENGTH = 80;
// 공유 미리보기는 자주 바뀌지 않으므로 같은 대상 조회는 잠시 재사용한다
const PREVIEW_REVALIDATE_SECONDS = 60;

// 링크 미리보기 수집기는 로그인하지 않으므로 비회원 기준으로 조회한다
// 실패해도 페이지는 열려야 하므로 null을 돌려주고 호출한 쪽에서 기본값을 쓴다
export async function fetchPublicPreview<T>(path: string): Promise<T | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      next: { revalidate: PREVIEW_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
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

// 공백을 정리하고 미리보기에 맞게 앞부분만 남긴다. 비어 있으면 사이트 설명을 쓴다
export function toPreviewDescription(text: string | null | undefined): string {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return SITE_DESCRIPTION;
  return trimmed.length > DESCRIPTION_MAX_LENGTH
    ? `${trimmed.slice(0, DESCRIPTION_MAX_LENGTH)}…`
    : trimmed;
}

type ShareMetadataInput = {
  // 사이트 이름을 뺀 제목. 없으면 사이트 이름만 쓴다
  title?: string;
  description?: string;
  // 공유 주소 (origin 제외, 쿼리 포함 가능)
  path: string;
  image?: { url: string; alt: string } | null;
  type?: 'website' | 'profile' | 'article';
};

// 제목·설명·이미지를 일반 메타데이터와 OG·트위터 카드에 같은 값으로 채운다
export async function buildShareMetadata({
  title,
  description = SITE_DESCRIPTION,
  path,
  image,
  type = 'website',
}: ShareMetadataInput): Promise<Metadata> {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

  return {
    metadataBase: await requestOrigin(),
    title: fullTitle,
    description,
    openGraph: {
      type,
      siteName: SITE_NAME,
      url: path,
      title: fullTitle,
      description,
      ...(image && { images: [{ url: image.url, alt: image.alt }] }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: fullTitle,
      description,
      ...(image && { images: [image.url] }),
    },
  };
}
