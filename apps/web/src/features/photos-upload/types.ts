import type { Category, Style } from '@snappick/shared';

export const ContentTypeOptions = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type ContentType = (typeof ContentTypeOptions)[number];

export type UploadStatus =
  'preparing' | 'waiting' | 'uploading' | 'uploaded' | 'failed';

export type PhotoDetail = {
  categories: Category[];
  styles: Style[];
  keywords: string[];
  description: string;
};

export type SelectedPhoto = {
  file: File;
  previewUrl: string;
  localId: string; //선택 시 부여, 모든 상태 업데이트의 기준
  //중복 확인용 원본 키 (리사이즈로 file이 바뀌어도 그대로)
  sourceKey: string;
  uploadKey?: string;
  status: UploadStatus;
  progress: number;
} & PhotoDetail;

//POST /me/photos/upload-urls : createUploadUrls
export type UploadFileInfo = {
  fileName: string;
  contentType: ContentType;
  fileSize: number;
};

export type UploadUrlsRequest = {
  files: UploadFileInfo[];
  policyAgreed: true; //false면 400 POLICY_NOT_AGREED
};

export type UploadUrlItem = {
  fileName: string;
  uploadKey: string;
  uploadUrl: string;
  expiresAt: string;
};

export type UploadUrlsResponse = {
  items: UploadUrlItem[];
};

//POST /me/photos : registerPhotos
export type RegisterPhotoItem = {
  uploadKey: string;
  categories: Category[];
  styles?: Style[];
  keywords?: string[];
  description?: string | null;
};

export type RegisterPhotosRequest = {
  items: RegisterPhotoItem[];
  representativeUploadKey?: string; //보내면 기존 대표를 이 사진으로 바꾼다 (안 보내면 기존 대표 유지)
};

export type RegisteredPhoto = {
  uploadKey: string;
  photoId: string;
  imageUrl: string;
  width: number;
  height: number;
};

export type FailedPhoto = {
  uploadKey: string;
  code: string;
  message: string;
};

export type RegisterPhotosResponse = {
  items: RegisteredPhoto[];
  failed: FailedPhoto[];
  representativePhotoId: string | null; //등록 후 작가의 현재 대표사진
  photoCount: number;
};

export type RegisterResult =
  | { kind: 'error' }
  | { kind: 'done'; succeededCount: number; failed: FailedPhoto[] };

export type IssueResult = 'ok' | 'failed' | 'unauthorized';

//GET /me/photos/{photoId} : getPhotoData
export type PhotoData = {
  photoId: string;
  imageUrl: string;
  createdAt: string;
  categories: Category[];
  styles: Style[];
  keywords: string[];
  description: string | null;
  isRepresentative: boolean;
};

export type BatchUpdate = { photoId: string } & {
  categories?: Category[];
  styles?: Style[];
  keywords?: string[];
  description?: string | null;
};

export type BatchRequest = {
  updates: BatchUpdate[];
  deletePhotoIds: string[];
  representativePhotoId?: string;
};

export type BatchResponse = {
  updatedCount: number;
  deletedCount: number;
  representativePhotoId: string | null;
  photoCount: number;
};
