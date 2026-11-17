import type { useAuth } from '@/features/auth/context/AuthContext';
import type {
  PhotoData,
  RegisterPhotosRequest,
  RegisterPhotosResponse,
  UploadUrlsRequest,
  UploadUrlsResponse,
} from './types';

type FetchWithAuth = ReturnType<typeof useAuth>['fetchWithAuth'];

//① POST /me/photos/upload-urls
export async function createUploadUrls(
  body: UploadUrlsRequest,
  fetchWithAuth: FetchWithAuth,
): Promise<UploadUrlsResponse> {
  const response = await fetchWithAuth<UploadUrlsResponse>(
    '/me/photos/upload-urls',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!response) throw new Error('업로드 URL 응답이 비어 있어요');
  return response;
}

//② PUT {uploadUrl}
//uploadUrl은 완성된 주소라 fetchWithAuth가 아니라 그냥 fetch로 보낸다 (인증은 URL 서명이 대신함)
//Content-Type은 ①에서 보낸 contentType과 같아야 한다 (형식·크기가 서명에 들어 있음)
//성공 200 본문 없음 / 실패 403(만료·서명), 400(형식·크기 불일치)
//로컬 개발은 로컬 저장소, 배포는 S3로 간다
export async function putFileToUploadUrl(
  uploadUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    //객체생성
    const xhr = new XMLHttpRequest();
    //initial설정
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    //진행률 받아오기
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
    };
    //http요청 종료
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`업로드 실패: ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('네트워크 오류'));
    };

    xhr.send(file);
  });
}

//③ POST /me/photos
//서버가 올린 파일을 확인하고 WebP로 변환해 사진 정보와 함께 등록한다
//201이어도 일부 사진은 failed에만 있을 수 있다 (파일 없음·이미지 아님)
//대표사진: 대표가 없을 때만 representativeUploadKey를 보내고, 이미 있으면 보내지 않는다 (변경은 관리 모달 PATCH)
//representativePhotoId는 이번 요청 결과가 아니라 등록 후 작가의 현재 대표사진이라 null 여부로 판단하지 않는다
//판단: 대표로 보낸 uploadKey의 items 속 photoId === representativePhotoId 인가
//  다르면 모달로 "대표사진이 지정되지 않았습니다. 다시 시도하기" 안내, 등록 자체는 성공으로 둔다 (Phase 3)
export async function registerPhotos(
  body: RegisterPhotosRequest,
  fetchWithAuth: FetchWithAuth,
): Promise<RegisterPhotosResponse> {
  const response = await fetchWithAuth<RegisterPhotosResponse>('/me/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response) throw new Error('사진 등록 응답이 비어 있어요');
  return response;
}

//④ GET /me/photos/{photoId}
//내 사진 한 장의 정보 (다른 작가 사진이면 403, 없으면 404)
export async function getPhotoData(
  photoId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotoData> {
  const response = await fetchWithAuth<PhotoData>(`/me/photos/${photoId}`, {});
  if (!response) throw new Error('사진 정보 응답이 비어 있어요');
  return response;
}
