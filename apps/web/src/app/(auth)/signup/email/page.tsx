import { redirect } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import SignupEmailForm from '@/features/auth/components/SignupEmailForm';

type SignupEmailPageProps = {
  searchParams: Promise<{
    accountType?: string | string[];
  }>;
};

// URL에서 선택한 회원 유형을 전달받음
export default async function SignupEmailPage({
  searchParams,
}: SignupEmailPageProps) {
  const { accountType } = await searchParams;

  // 회원 유형이 올바르지 않으면 회원 유형 선택 화면으로 이동함
  if (accountType !== 'USER' && accountType !== 'PHOTOGRAPHER') {
    redirect('/signup');
  }

  return (
    <PageContainer>
      <SignupEmailForm accountType={accountType} />
    </PageContainer>
  );
}
