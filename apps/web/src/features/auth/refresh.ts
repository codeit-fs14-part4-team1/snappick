import { refreshAccessToken } from './api';

// 동시에 발생한 Refresh 요청을 하나로 통합함
const refreshPromises = new WeakMap<object, Promise<string>>();

// 진행 중인 Refresh 요청이 있으면 결과를 재사용함
export function refreshSession(session: object): Promise<string> {
  let refreshPromise = refreshPromises.get(session);
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromises.delete(session);
    });
    refreshPromises.set(session, refreshPromise);
  }

  return refreshPromise;
}
