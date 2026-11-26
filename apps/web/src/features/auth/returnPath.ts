// 로그인 후 원래 화면으로 돌아가기 위한 경로를 잠시 보관합니다.
// 결제 결과 주소에는 paymentKey가 있어 로그인 주소의 쿼리로 넘기지 않습니다.
const STORAGE_KEY = 'snappick:returnPath';
const EXPIRES_MS = 10 * 60 * 1000;

export function saveReturnPath() {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        path: `${window.location.pathname}${window.location.search}`,
        savedAt: Date.now(),
      }),
    );
  } catch {
    // 저장소를 쓸 수 없으면 로그인 후 메인으로 이동합니다.
  }
}

// 한 번 꺼내면 지웁니다. 오래됐거나 올바르지 않으면 메인을 반환합니다.
export function takeReturnPath(): string {
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? 'null',
    );
    sessionStorage.removeItem(STORAGE_KEY);

    if (
      saved &&
      typeof saved === 'object' &&
      'path' in saved &&
      typeof saved.path === 'string' &&
      'savedAt' in saved &&
      typeof saved.savedAt === 'number' &&
      Date.now() - saved.savedAt <= EXPIRES_MS
    ) {
      // 외부 주소로 이동하지 않도록 같은 출처인지 확인합니다.
      const url = new URL(saved.path, window.location.origin);
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}`;
      }
    }
  } catch {
    // 저장된 값이 올바르지 않으면 메인으로 이동합니다.
  }
  return '/';
}
