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
//진행률 받으려고 fetch 대신 xhr
//Content-Type은 ①의 contentType과 같아야 함 (형식·크기가 서명에 들어 있음)
//성공 200 본문 없음 / 실패 403(만료·서명), 400(형식·크기 불일치)
//저장소는 STORAGE_DRIVER로 결정 (local: apps/web/public, s3: 버킷)
export async function putFileToUploadUrl(
  uploadUrl: string,
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal, //중단신호
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    //이미 중단됐으면 시작 안 함
    if (signal?.aborted) {
      reject(new DOMException('업로드 중단', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    //중단 신호 오면 xhr 끊기, 끊기면 실패와 구분되는 AbortError (fetch와 같은 모양)
    const abortXhr = () => xhr.abort();
    signal?.addEventListener('abort', abortXhr);
    xhr.onabort = () => reject(new DOMException('업로드 중단', 'AbortError'));

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
    };
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

    //성공·실패·중단 모두 끝나면 리스너 정리 (컨트롤러를 여러 PUT이 같이 씀)
    xhr.onloadend = () => signal?.removeEventListener('abort', abortXhr);
    xhr.send(file);
  });
}

//③ POST /me/photos
//서버가 올린 파일 확인 → WebP 변환 → 사진 정보와 함께 등록
//201이어도 일부는 failed에만 있을 수 있음 (파일 없음·이미지 아님)
//대표사진: 켠 사진의 uploadKey를 보내면 기존 대표 교체 (안 보내면 유지)
//representativePhotoId는 등록 후 작가의 현재 대표사진 (이번 요청 결과 아님)
//TODO(Phase 3): 대표로 보낸 사진의 photoId ≠ representativePhotoId면 "대표 지정 실패" 안내 (등록은 성공 유지)
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
