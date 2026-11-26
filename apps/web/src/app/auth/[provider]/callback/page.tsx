import { notFound } from 'next/navigation';
import SocialAuthCallback from '@/features/auth/components/SocialAuthCallback';

type SocialAuthCallbackPageProps = {
  params: Promise<{
    provider: string;
  }>;
};

// 소셜 제공자의 인증 결과를 공통 콜백 컴포넌트로 전달함
export default async function SocialAuthCallbackPage({
  params,
}: SocialAuthCallbackPageProps) {
  const { provider } = await params;

  // 지원하지 않는 소셜 제공자의 콜백 경로는 차단함
  if (!['kakao', 'naver', 'google'].includes(provider)) {
    notFound();
  }

  return <SocialAuthCallback />;
}
