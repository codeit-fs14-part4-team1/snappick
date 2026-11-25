'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import StateMessage from '@/components/ui/StateMessage';
import { useAuth } from '@/features/auth/context/AuthContext';
import { saveReturnPath } from '@/features/auth/returnPath';
import styles from './layout.module.css';

// 보호 경로의 인증 확인과 안내 화면을 공통으로 처리합니다.
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  if (authStatus === 'initializing') {
    return (
      <PageContainer>
        <StateMessage
          className={styles.state}
          title="로그인 정보를 확인하고 있어요."
          role="status"
        />
      </PageContainer>
    );
  }

  if (authStatus === 'error') {
    return (
      <PageContainer>
        <StateMessage
          className={styles.state}
          title="로그인 정보를 확인하지 못했어요"
          role="alert"
          button={{
            label: '다시 시도',
            onClick: () => window.location.reload(),
          }}
        />
      </PageContainer>
    );
  }

  if (!user || authStatus !== 'authenticated') {
    return (
      <PageContainer>
        <StateMessage
          className={styles.state}
          title="로그인이 필요해요"
          description="로그인 후 이용할 수 있어요."
          button={{
            label: '로그인',
            onClick: () => {
              saveReturnPath();
              router.push('/login');
            },
          }}
        />
      </PageContainer>
    );
  }

  return children;
}
