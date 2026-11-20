import { ContentTypeOptions } from './types';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
//최대 장수 (서버와 같음)
export const MAX_PHOTOS = 20;

//중복 확인용 키 (리사이즈 전 원본으로)
export function toSourceKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function isAllowedFileType(type: string) {
  return ContentTypeOptions.some((t) => t === type);
}
export function validateFile(file: File): string | null {
  if (!isAllowedFileType(file.type)) return 'JPG, PNG, WebP만 올릴 수 있어요.';
  if (!(file.name.length < 255)) return '파일 이름이 너무 길어요.';
  if (file.size > MAX_FILE_SIZE)
    return '파일 크기는 최대 20MB까지 업로드할 수 있어요.';
  return null;
}
