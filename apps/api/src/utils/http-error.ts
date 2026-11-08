export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    // 에러 응답에 함께 내려줄 추가 정보 (예: 이미 존재하는 리소스의 ID)
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
