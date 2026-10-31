import { refreshAccessToken } from './api';

// 동시에 발생한 Refresh 요청을 하나로 통합함
let refreshPromise: Promise<string> | null = null;

// 진행 중인 Refresh 요청이 있으면 결과를 재사용함
export function refreshSession(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}
