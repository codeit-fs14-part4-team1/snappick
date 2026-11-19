'use client';

import type { ReactNode } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import StateMessage from '@/components/ui/StateMessage';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../types';
import styles from './AuthGuard.module.css';

type AuthGuardProps = {
  loginDescription: string;
  children: (user: AuthUser) => ReactNode;
};

/** 인증된 경우에만 콘텐츠를 렌더링합니다. 토큰 요청·갱신은 기존 AuthContext가 담당합니다. */
export default function AuthGuard({
  loginDescription,
  children,
}: AuthGuardProps) {
  const { user, authStatus } = useAuth();

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
          description={loginDescription}
          link={{ label: '로그인', href: '/login' }}
        />
      </PageContainer>
    );
  }

  return children(user);
}
