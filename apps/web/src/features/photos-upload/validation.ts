import { ContentTypeOptions } from './types';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
//모달 최대 장수 (서버 MAX_FILES_PER_REQUEST와 같음)
export const MAX_PHOTOS = 20;

//중복 확인용 키: 이름|크기|수정 시각 (|가 없으면 'a1'+23과 'a'+123이 같아짐)
//리사이즈 전 원본으로 만들 것 (리사이즈본은 크기·수정 시각이 다름)
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
