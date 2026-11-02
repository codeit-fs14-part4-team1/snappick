import { apiFetch } from '@/lib/api';
import type { AuthUser } from '@/features/auth/types';

// Access Token으로 로그인한 사용자 정보를 조회함
export async function getMe(accessToken: string): Promise<AuthUser> {
  const response = await apiFetch<AuthUser>('/users/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response) {
    throw new Error('사용자 정보를 불러오지 못했습니다.');
  }

  return response;
}

type RefreshResponse = {
  accessToken: string;
};

// Refresh Token 쿠키로 Access Token을 재발급받음
export async function refreshAccessToken(): Promise<string> {
  const response = await apiFetch<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response?.accessToken) {
    throw new Error('Access Token 재발급 응답이 올바르지 않습니다.');
  }

  return response.accessToken;
}

// Refresh Token 세션을 종료함
export async function logoutSession(): Promise<void> {
  await apiFetch<void>('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
