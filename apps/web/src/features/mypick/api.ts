import type { FetchWithAuth } from '@/features/auth/types';
import type {
  MyPickParams,
  LikedPhotosResponse,
  SavedPhotographersResponse,
} from './types';

//경로 공통 헬퍼함수
function withQuery(path: string, params: MyPickParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

//좋아요한 사진 목록: GET /me/liked-photos
export async function getLikedPhotos(
  params: MyPickParams,
  fetchWithAuth: FetchWithAuth,
): Promise<LikedPhotosResponse> {
  const response = await fetchWithAuth<LikedPhotosResponse>(
    withQuery('/me/liked-photos', params),
  );
  if (!response) throw new Error('좋아요한 사진 목록을 불러오지 못했어요.');
  return response;
}

//저장한 작가 목록: GET /me/saved-photographers
export async function getSavedPhotographers(
  params: MyPickParams,
  fetchWithAuth: FetchWithAuth,
): Promise<SavedPhotographersResponse> {
  const response = await fetchWithAuth<SavedPhotographersResponse>(
    withQuery('/me/saved-photographers', params),
  );
  if (!response) throw new Error('저장한 작가 목록을 불러오지 못했어요.');
  return response;
}
