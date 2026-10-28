import PageContainer from '@/components/layout/PageContainer';
import SignupTypeSelector from '@/features/auth/components/SignupTypeSelector';

// 공통 페이지 컨테이너 안에 회원 유형 선택 화면을 배치함
export default function SignupPage() {
  return (
    <PageContainer>
      <SignupTypeSelector />
    </PageContainer>
  );
}
