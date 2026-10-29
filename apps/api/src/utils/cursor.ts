import { HttpError } from './http-error.js';

/**
 * 커서 방식 목록의 다음 페이지 기준값을 base64url 문자열로 주고받는다
 * FE는 응답의 nextCursor를 그대로 다음 요청에 보낸다
 */
export const encodeCursor = (value: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8'),
    );
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // 아래에서 INVALID_CURSOR로 처리
  }
  throw new HttpError(400, 'INVALID_CURSOR', '목록을 다시 불러와 주세요.');
}

/**
 * 몇 번째부터인지(o)와 같은 목록인지 확인할 값(k)을 담는 커서
 * 정렬·필터가 다른 목록의 커서를 보내면 INVALID_CURSOR
 */
export function readOffset(cursor: string | undefined, key: string): number {
  if (!cursor) {
    return 0;
  }
  const { o, k } = decodeCursor(cursor);
  if (typeof o !== 'number' || !Number.isInteger(o) || o < 0 || k !== key) {
    throw new HttpError(400, 'INVALID_CURSOR', '목록을 다시 불러와 주세요.');
  }
  return o;
}

export const nextCursor = (offset: number, key: string): string =>
  encodeCursor({ o: offset, k: key });
