'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getMe } from '@/features/auth/api';
import { refreshSession } from '@/features/auth/refresh';
import type { AuthUser } from '@/features/auth/types';
import { authFetch } from '@/features/auth/authFetch';

// 인증 상태를 구분하는 타입을 정의함
type AuthStatus =
  'initializing' | 'authenticated' | 'unauthenticated' | 'error';

// 인증 Context에서 공유할 값의 타입을 정의함
type AuthContextValue = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;

  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;

  authStatus: AuthStatus;
  setAuthStatus: (status: AuthStatus) => void;

  fetchUser: (token: string) => Promise<void>;
  clearAuth: () => void;
};

// 인증 정보를 공유할 Context를 생성함
const AuthContext = createContext<AuthContextValue | null>(null);

// 하위 컴포넌트에서 사용할 인증 상태를 관리함
export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');

  // 인증 정보가 변경될 때마다 버전을 증가시킴
  const authVersionRef = useRef(0);

  // 토큰 변경 시 이전 세션 복구 결과를 무효화함
  const setAccessToken = useCallback((token: string | null) => {
    authVersionRef.current += 1;
    setAccessTokenState(token);
  }, []);

  // Access Token으로 사용자 정보를 조회함
  const fetchUser = useCallback(
    async (token: string) => {
      // 사용자 정보 조회를 시작한 시점의 인증 버전을 저장함
      let requestVersion = authVersionRef.current;

      try {
        const userData = await authFetch<AuthUser>(
          '/users/me',
          { method: 'GET' },
          {
            accessToken: token,
            onTokenRefresh: (newToken) => {
              // 이전 요청이 최신 인증 정보를 덮어쓰지 않도록 방지함
              if (authVersionRef.current !== requestVersion) return;

              setAccessToken(newToken);

              // 정상적인 토큰 재발급은 현재 요청의 버전에 반영함
              requestVersion = authVersionRef.current;
            },
          },
        );

        // 인증 정보가 변경되었다면 이전 조회 결과를 무시함
        if (authVersionRef.current !== requestVersion) return;

        if (!userData) {
          throw new Error('사용자 정보를 불러오지 못했습니다.');
        }

        setUser(userData);
        setAuthStatus('authenticated');
      } catch (error) {
        // 인증 정보가 변경되었다면 이전 요청의 오류를 무시함
        if (authVersionRef.current !== requestVersion) return;

        // 인증이 유효하지 않은 경우에만 인증 정보를 초기화함
        if (error instanceof Error && error.message === 'API 요청 실패: 401') {
          setAccessToken(null);
          setUser(null);
          setAuthStatus('unauthenticated');
        }

        throw error;
      }
    },
    [setAccessToken],
  );

  // 메모리에 저장된 인증 정보를 초기화함
  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setAuthStatus('unauthenticated');
  }, [setAccessToken]);

  // 앱 실행 시 Refresh Token으로 로그인 상태를 복구함
  useEffect(() => {
    let cancelled = false;
    const restoreVersion = authVersionRef.current;

    async function restoreSession() {
      try {
        const token = await refreshSession();
        const userData = await getMe(token);

        // 최신 인증 정보가 변경되었다면 이전 복구 결과를 무시함
        if (cancelled || authVersionRef.current !== restoreVersion) return;

        setAccessTokenState(token);
        setUser(userData);
        setAuthStatus('authenticated');
      } catch (error) {
        // 최신 인증 정보가 변경되었다면 이전 오류를 무시함
        if (cancelled || authVersionRef.current !== restoreVersion) return;

        setAccessTokenState(null);
        setUser(null);

        // Refresh Token이 유효하지 않으면 비로그인 상태로 처리함
        if (error instanceof Error && error.message === 'API 요청 실패: 401') {
          setAuthStatus('unauthenticated');
          return;
        }

        // 서버 또는 네트워크 오류는 인증 확인 실패로 처리함
        setAuthStatus('error');
        console.error('인증 세션 복구 실패:', error);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // 인증 상태와 관리 함수를 하위 컴포넌트에 제공함
  const value = useMemo(
    () => ({
      accessToken,
      setAccessToken,
      user,
      setUser,
      authStatus,
      setAuthStatus,
      fetchUser,
      clearAuth,
    }),
    [accessToken, user, authStatus, setAccessToken, fetchUser, clearAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 다른 컴포넌트에서 인증 Context를 사용할 수 있도록 함
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  }

  return context;
}
