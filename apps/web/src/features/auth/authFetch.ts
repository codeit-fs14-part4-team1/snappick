import { createApiError } from '@/lib/api';

type AuthFetchOptions = {
  accessToken: string;
  refreshToken: () => Promise<string>;
  onTokenRefresh: (token: string) => void;
};

// 인증이 필요한 API 요청에 Access Token을 사용함
export async function authFetch<T>(
  path: string,
  options: RequestInit,
  auth: AuthFetchOptions,
): Promise<T | undefined> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL이 설정되지 않았습니다.');
  }

  // Access Token을 포함하여 API를 요청함
  async function request(token: string): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  }

  let response = await request(auth.accessToken);

  // 401 오류의 원인을 확인하고 Access Token 재발급 여부를 결정함
  if (response.status === 401) {
    const error = await createApiError(response);

    // 소셜 인가 코드 오류는 토큰 재발급 및 API 재요청 대상에서 제외함
    if (error.code === 'INVALID_SOCIAL_AUTH') {
      throw error;
    }

    const newToken = await auth.refreshToken();

    auth.onTokenRefresh(newToken);
    response = await request(newToken);
  }

  // HTTP 상태 코드와 서버의 상세 오류 정보를 함께 전달함
  if (!response.ok) {
    throw await createApiError(response);
  }

  // 본문이 없는 응답은 JSON으로 변환하지 않음
  if (response.status === 204) {
    return;
  }

  return response.json() as Promise<T>;
}
