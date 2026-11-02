'use client';

import Header, { type HeaderUser } from '@/components/layout/Header';
import { useAuth } from '@/features/auth/context/AuthContext';

// 인증 상태를 기존 Header에 전달함
export default function AuthHeader() {
  const { user, authStatus } = useAuth();

  // 로그인 사용자 정보를 Header에서 사용하는 형식으로 변환함
  const headerUser: HeaderUser | null =
    authStatus === 'authenticated' && user
      ? {
          id: user.id,
          nickname: user.nickname,
          accountType: user.accountType,
          profileImageUrl: user.profileImageUrl,
        }
      : null;

  return <Header user={headerUser} hasUnreadNotifications={false} />;
}
