import type { AuthUser } from '@/features/auth/types';
import type { useAuth } from '@/features/auth/context/AuthContext';

type AuthStatus = ReturnType<typeof useAuth>['authStatus'];

//좋아요 영역을 그릴 때 구분하는 사용자 유형
//pending: 로그인 확인 중, unknown: 로그인 확인 실패로 로그인 여부를 알 수 없음
export type ViewerKind =
  'pending' | 'unknown' | 'guest' | 'user' | 'photographer';

//인증 상태와 계정 유형으로 사용자 유형을 정함
export function getViewerKind(
  authStatus: AuthStatus,
  user: AuthUser | null,
): ViewerKind {
  if (authStatus === 'initializing') return 'pending';
  if (authStatus === 'unauthenticated') return 'guest';
  if (authStatus === 'authenticated' && user)
    return user.accountType === 'PHOTOGRAPHER' ? 'photographer' : 'user';
  return 'unknown';
}
