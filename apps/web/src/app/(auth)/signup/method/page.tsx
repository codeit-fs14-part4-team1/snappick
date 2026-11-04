import { redirect } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import SignupMethodSelector from '@/features/auth/components/SignupMethodSelector';

type SignupMethodPageProps = {
  searchParams: Promise<{
    accountType?: string | string[];
  }>;
};

// 앞 단계에서 선택한 회원 유형을 받아 가입 방법 선택 화면에 전달함
export default async function SignupMethodPage({
  searchParams,
}: SignupMethodPageProps) {
  const { accountType } = await searchParams;

  // 올바른 회원 유형이 없으면 회원 유형 선택 화면으로 이동함
  if (accountType !== 'USER' && accountType !== 'PHOTOGRAPHER') {
    redirect('/signup');
  }

  return (
    <PageContainer>
      <SignupMethodSelector accountType={accountType} />
    </PageContainer>
  );
}
