const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// HTTP 상태 코드와 서버의 상세 오류 정보를 관리하는 공통 에러 클래스
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly serverMessage: string | undefined;

  constructor(status: number, code?: string, serverMessage?: string) {
    // 기존 인증 및 API 오류 처리 방식과의 호환성을 유지
    super(`API 요청 실패: ${status}`);

    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
  }
}

// 서버 오류 응답을 공통 ApiError 객체로 변환
export async function createApiError(response: Response): Promise<ApiError> {
  let body: unknown;

  // JSON 형식이 아닌 오류 응답도 HTTP 상태 코드로 처리
  try {
    body = await response.json();
  } catch {
    return new ApiError(response.status);
  }

  if (typeof body !== 'object' || body === null) {
    return new ApiError(response.status);
  }

  const { code, message } = body as Record<string, unknown>;

  return new ApiError(
    response.status,
    typeof code === 'string' ? code : undefined,
    typeof message === 'string' ? message : undefined,
  );
}

// 공통 API 요청 및 응답을 처리
export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T | undefined> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL이 설정되지 않았습니다.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
  });

  // HTTP 상태 코드와 서버의 상세 오류 정보를 함께 전달
  if (!response.ok) {
    throw await createApiError(response);
  }

  if (response.status === 204) {
    return;
  }

  return response.json() as Promise<T>;
}
