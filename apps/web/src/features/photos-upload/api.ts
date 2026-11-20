import type { useAuth } from '@/features/auth/context/AuthContext';
import type {
  BatchRequest,
  BatchResponse,
  PhotoData,
  RegisterPhotosRequest,
  RegisterPhotosResponse,
  UploadUrlsRequest,
  UploadUrlsResponse,
} from './types';

type FetchWithAuth = ReturnType<typeof useAuth>['fetchWithAuth'];

//① 업로드 URL 발급: POST /me/photos/upload-urls
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

//② 파일 업로드: PUT {uploadUrl} (진행률 때문에 xhr 사용)
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
    //중단
    const abortXhr = () => xhr.abort();
    signal?.addEventListener('abort', abortXhr);
    xhr.onabort = () => reject(new DOMException('업로드 중단', 'AbortError'));

    xhr.open('PUT', uploadUrl);
    //① 때 보낸 파일 형식과 같아야 함 (서명에 포함)
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
    //cleanup
    xhr.onloadend = () => signal?.removeEventListener('abort', abortXhr);
    xhr.send(file);
  });
}

//③ 사진 등록: POST /me/photos (201: 성공 · 실패 같이 돌려줌)
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

//④ 사진 정보 조회: GET /me/photos/{photoId}
export async function getPhotoData(
  photoId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotoData> {
  const response = await fetchWithAuth<PhotoData>(`/me/photos/${photoId}`, {});
  if (!response) throw new Error('사진 정보 응답이 비어 있어요');
  return response;
}

//⑤ 사진 일괄 수정: PATCH /me/photos/batch (수정 · 삭제 각 20개)
export async function batchPhotos(
  body: BatchRequest,
  fetchWithAuth: FetchWithAuth,
): Promise<BatchResponse> {
  const response = await fetchWithAuth<BatchResponse>(`/me/photos/batch`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response) throw new Error('사진 업데이트 대한 응답을 받지 못했어요.');
  return response;
}
