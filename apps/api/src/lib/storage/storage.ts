/**
 * 사진 파일 저장소. 개발은 로컬 디스크, 배포는 S3를 쓴다 (STORAGE_DRIVER)
 * 임시 원본: 'uploads/{photographerId}/{uuid}.png' (FE가 직접 올리고, 등록하면 지운다)
 * 보관본: 'photos/{photographerId}/{uuid}.webp' (photos.storage_location에 저장)
 */
export type UploadTarget = {
  key: string;
  contentType: string;
  size: number;
  expiresAt: Date;
  /** 요청이 들어온 API 주소. 로컬 저장소의 업로드 URL에만 쓴다 */
  apiOrigin: string;
};

export type StoredObject = {
  size: number;
  contentType: string | null;
};

export interface Storage {
  /** FE가 파일을 직접 PUT할 URL */
  createUploadUrl(target: UploadTarget): Promise<string>;
  /** 파일이 없으면 null */
  head(key: string): Promise<StoredObject | null>;
  read(key: string): Promise<Uint8Array>;
  write(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** 파일이 없어도 오류로 보지 않는다 */
  delete(key: string): Promise<void>;
}
