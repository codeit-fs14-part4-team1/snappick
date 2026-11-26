import { apiFetch } from '@/lib/api';
import type {
  AuthUser,
  SocialLoginInput,
  SocialSignupInput,
  SocialAuthResponse,
} from '@/features/auth/types';

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
// 소셜 인증 정보를 이용해 회원가입을 요청함
export async function socialSignup(
  input: SocialSignupInput,
): Promise<SocialAuthResponse> {
  const response = await apiFetch<SocialAuthResponse>('/auth/signup', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response?.accessToken) {
    throw new Error('회원가입 응답에 Access Token이 없습니다.');
  }

  return response;
}

// 소셜 인증 정보를 이용해 로그인을 요청함
export async function socialLogin(
  input: SocialLoginInput,
): Promise<SocialAuthResponse> {
  const response = await apiFetch<SocialAuthResponse>('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response?.accessToken) {
    throw new Error('로그인 응답에 Access Token이 없습니다.');
  }

  return response;
}
