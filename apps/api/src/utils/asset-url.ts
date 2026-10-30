const DEFAULT_IMAGE_BASE_URL = 'http://localhost:3000';

const imageBaseUrl = (
  process.env.IMAGE_BASE_URL ?? DEFAULT_IMAGE_BASE_URL
).replace(/\/+$/, '');

/**
 * DB에 저장된 이미지 경로(storage_location 등)를 응답용 전체 주소로 바꾼다
 * 이미 전체 주소(http, https)면 그대로 돌려준다
 * 예: '/mock/photos/WED-1-1.webp' → 'http://localhost:3000/mock/photos/WED-1-1.webp'
 */
export function toImageUrl(path: string): string;
export function toImageUrl(path: string | null): string | null;
export function toImageUrl(path: string | null): string | null {
  if (path === null) {
    return null;
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${imageBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}
