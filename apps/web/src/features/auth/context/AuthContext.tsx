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

import { useQueryClient } from '@tanstack/react-query';

import { getMe, logoutSession } from '@/features/auth/api';
import { authFetch } from '@/features/auth/authFetch';
import { refreshSession } from '@/features/auth/refresh';
import type { AuthUser } from '@/features/auth/types';
import { apiFetch } from '@/lib/api';

// 인증 상태를 구분하는 타입 정의
type AuthStatus =
  'initializing' | 'authenticated' | 'unauthenticated' | 'error';

// 공통 인증 요청 옵션 정의
type FetchWithAuthOptions = {
  optionalAuth?: boolean;
};

// 공통 인증 요청 함수 타입 정의
type FetchWithAuth = <T>(
  path: string,
  options?: RequestInit,
  config?: FetchWithAuthOptions,
) => Promise<T | undefined>;

// 인증 Context에서 공유할 값의 타입 정의
type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  authStatus: AuthStatus;
  clearAuth: () => void;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchWithAuth: FetchWithAuth;
};

// 인증 정보를 공유할 Context 생성
const AuthContext = createContext<AuthContextValue | null>(null);

// 하위 컴포넌트에서 사용할 인증 상태를 관리함
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');

  // API 요청에서 최신 Access Token을 참조함
  const accessTokenRef = useRef<string | null>(null);

  // 인증 정보 변경 시 이전 비동기 요청을 무효화함
  const authVersionRef = useRef(0);

  // 로그인 계정 변경과 토큰 재발급을 구분함
  const sessionVersionRef = useRef(0);

  // 토큰 변경 시 Ref와 State를 함께 갱신함
  const setAccessToken = useCallback((token: string | null) => {
    authVersionRef.current += 1;
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  // Access Token으로 사용자 정보를 조회함
  const fetchUser = useCallback(
    async (token: string) => {
      // 사용자 정보 조회 시점의 인증 버전을 저장함
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

          // 이전 사용자 캐시를 삭제함
          queryClient.clear();
        }

        throw error;
      }
    },
    [setAccessToken, queryClient],
  );

  // 인증 정보와 React Query 캐시를 초기화함
  const clearAuth = useCallback(() => {
    // 기존 세션에서 시작한 요청을 무효화함
    sessionVersionRef.current += 1;

    setAccessToken(null);
    setUser(null);
    setAuthStatus('unauthenticated');
    queryClient.clear();
  }, [setAccessToken, queryClient]);

  // 다른 기능에서 공통으로 사용할 인증 API 요청 함수
  const fetchWithAuth = useCallback(
    async <T,>(
      path: string,
      options: RequestInit = {},
      config: FetchWithAuthOptions = {},
    ): Promise<T | undefined> => {
      // 요청 시점의 최신 Access Token을 가져옴
      const token = accessTokenRef.current;

      // Access Token이 없는 경우 처리함
      if (!token) {
        if (config.optionalAuth) {
          // 비회원 요청에서는 Authorization 헤더를 제거함
          const headers = new Headers(options.headers);
          headers.delete('Authorization');

          return apiFetch<T>(path, {
            ...options,
            headers,
          });
        }

        throw new Error('로그인이 필요한 요청입니다.');
      }

      // 요청 시작 시점의 로그인 세션을 저장함
      const requestSessionVersion = sessionVersionRef.current;

      // Refresh 성공 여부를 구분함
      let refreshSucceeded = false;

      try {
        // 인증 API 요청 및 토큰 재발급을 처리함
        const result = await authFetch<T>(path, options, {
          accessToken: token,

          onTokenRefresh: (newToken) => {
            // Refresh 요청 성공 여부를 기록함
            refreshSucceeded = true;

            // 다른 계정으로 변경되었다면 이전 요청을 중단함
            if (sessionVersionRef.current !== requestSessionVersion) {
              throw new Error('요청 중 인증 상태가 변경되었습니다.');
            }

            // 갱신된 Access Token을 Context에 반영함
            if (accessTokenRef.current !== newToken) {
              setAccessToken(newToken);
            }
          },
        });

        // 요청 중 로그인 세션이 변경되었다면 결과를 무시함
        if (sessionVersionRef.current !== requestSessionVersion) {
          throw new Error('요청 중 인증 상태가 변경되었습니다.');
        }

        return result;
      } catch (error) {
        // Refresh 자체가 401로 실패한 경우에만 인증을 초기화함
        if (
          !refreshSucceeded &&
          error instanceof Error &&
          error.message === 'API 요청 실패: 401' &&
          sessionVersionRef.current === requestSessionVersion &&
          accessTokenRef.current === token
        ) {
          clearAuth();
        }

        throw error;
      }
    },
    [setAccessToken, clearAuth],
  );

  // 토큰 저장과 사용자 정보 조회를 공통으로 처리함
  const login = useCallback(
    async (token: string) => {
      // 기존 세션의 비동기 요청을 무효화함
      sessionVersionRef.current += 1;

      queryClient.clear();
      setAccessToken(token);
      setUser(null);
      setAuthStatus('initializing');

      try {
        await fetchUser(token);
      } catch (error) {
        clearAuth();
        throw error;
      }
    },
    [queryClient, setAccessToken, fetchUser, clearAuth],
  );

  // 서버 로그아웃 성공 후 인증 정보를 초기화함
  const logout = useCallback(async () => {
    await logoutSession();
    clearAuth();
  }, [clearAuth]);

  // 앱 실행 시 Refresh Token으로 로그인 상태를 복구함
  useEffect(() => {
    let cancelled = false;
    const restoreVersion = authVersionRef.current;

    async function restoreSession() {
      try {
        const token = await refreshSession();

        // 이전 세션 복구가 취소되었다면 사용자 정보 조회를 중단함
        if (cancelled || authVersionRef.current !== restoreVersion) return;

        const userData = await getMe(token);

        // 사용자 정보 조회 중 인증 상태가 변경되었다면 결과를 무시함
        if (cancelled || authVersionRef.current !== restoreVersion) return;

        // 복구된 로그인 세션을 반영함
        sessionVersionRef.current += 1;

        // 복구된 Access Token을 Ref와 State에 반영함
        accessTokenRef.current = token;
        setAccessTokenState(token);
        setUser(userData);
        setAuthStatus('authenticated');
      } catch (error) {
        // 최신 인증 정보가 변경되었다면 이전 오류를 무시함
        if (cancelled || authVersionRef.current !== restoreVersion) return;

        // 세션 복구 실패 시 토큰 참조값도 초기화함
        accessTokenRef.current = null;
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

  // 인증 상태와 공통 API 요청 함수를 하위 컴포넌트에 제공함
  const value = useMemo(
    () => ({
      accessToken,
      user,
      authStatus,
      clearAuth,
      login,
      logout,
      fetchWithAuth,
    }),
    [accessToken, user, authStatus, clearAuth, login, logout, fetchWithAuth],
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
