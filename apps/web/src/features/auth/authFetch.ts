import { refreshSession } from './refresh';

type AuthFetchOptions = {
  accessToken: string;
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

  // Access Token이 만료되면 한 번만 재발급을 시도함
  if (response.status === 401) {
    const newToken = await refreshSession();

    auth.onTokenRefresh(newToken);
    response = await request(newToken);
  }

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  if (response.status === 204) {
    return;
  }

  return response.json() as Promise<T>;
}
