const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T | undefined> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL이 설정되지 않았습니다.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  if (response.status === 204) {
    return;
  }

  return response.json() as Promise<T>;
}
