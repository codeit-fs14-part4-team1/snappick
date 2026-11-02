import PageContainer from '@/components/layout/PageContainer';
import LoginForm from '@/features/auth/components/LoginForm';

// 공통 페이지 컨테이너 안에 로그인 폼을 배치함
export default function LoginPage() {
  return (
    <PageContainer>
      <LoginForm />
    </PageContainer>
  );
}
