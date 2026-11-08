//'/photos/{photoId}'
//'/photographers/{photographerId}/photos'
//둘 다 비회원 허용: optionalAuth로 요청, 로그인 시 liked·saved 포함

import type { useAuth } from '@/features/auth/context/AuthContext';
import type {
  PhotoDetail,
  PhotographerPhotosParams,
  PhotographerPhotosResponse,
} from './types';

type FetchWithAuth = ReturnType<typeof useAuth>['fetchWithAuth'];

export async function getPhotoDetail(
  photoId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotoDetail> {
  const response = await fetchWithAuth<PhotoDetail>(
    `/photos/${photoId}`,
    {},
    { optionalAuth: true },
  );
  if (!response) throw new Error('사진 정보를 불러오지 못했어요');
  return response;
}

export async function getPhotographerPhotos(
  photographerId: string,
  params: PhotographerPhotosParams,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerPhotosResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  const path = query
    ? `/photographers/${photographerId}/photos?${query}`
    : `/photographers/${photographerId}/photos`;
  const response = await fetchWithAuth<PhotographerPhotosResponse>(
    path,
    {},
    { optionalAuth: true },
  );
  if (!response) throw new Error('작가 사진을 불러오지 못했어요');
  return response;
}
