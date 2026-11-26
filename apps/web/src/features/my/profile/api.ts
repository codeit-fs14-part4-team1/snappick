import type { FetchWithAuth } from '@/features/auth/types';
import type { SocialLoginInput } from '@/features/auth/types';
import type {
  MyAccountResponse,
  UpdateMyNicknameInput,
  UpdateMyNicknameResponse,
  ChangeMyPasswordInput,
} from './types';

// 현재 로그인 방식 및 연결된 계정 정보를 조회함
export async function getMyAccount(
  fetchWithAuth: FetchWithAuth,
): Promise<MyAccountResponse> {
  const response = await fetchWithAuth<MyAccountResponse>('/auth/account', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response) {
    throw new Error('계정 정보를 불러오지 못했어요.');
  }

  return response;
}

// 일반 사용자의 닉네임을 수정함
export async function updateMyNickname(
  input: UpdateMyNicknameInput,
  fetchWithAuth: FetchWithAuth,
): Promise<UpdateMyNicknameResponse> {
  const response = await fetchWithAuth<UpdateMyNicknameResponse>('/users/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response) {
    throw new Error('닉네임을 수정하지 못했어요.');
  }

  return response;
}

// 이메일 로그인 사용자의 비밀번호를 변경함
export async function changeMyPassword(
  input: ChangeMyPasswordInput,
  fetchWithAuth: FetchWithAuth,
): Promise<void> {
  await fetchWithAuth<void>('/auth/password', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    // 비밀번호 변경 후 현재 로그인 세션을 유지하기 위해 쿠키를 함께 전달함
    credentials: 'include',
    body: JSON.stringify(input),
  });
}

// 현재 로그인한 계정에 새로운 소셜 로그인 방식을 연동함
export async function linkSocialProvider(
  input: SocialLoginInput,
  fetchWithAuth: FetchWithAuth,
): Promise<void> {
  await fetchWithAuth<void>('/auth/providers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}
