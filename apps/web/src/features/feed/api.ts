//'/photos'
//'/photos/{photoId}/like'

import type { FetchWithAuth } from '@/features/auth/types';
import type {
  FeedPhotosParams,
  FeedPhotosResponse,
  PhotoLikeResponse,
} from './types';

export async function getFeedPhotos(
  params: FeedPhotosParams,
  fetchWithAuth: FetchWithAuth,
): Promise<FeedPhotosResponse> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const isEmpty = value === '' || value === undefined;
    if (isEmpty) return;

    if (Array.isArray(value)) {
      if (value.length > 0) searchParams.set(key, value.join(','));
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  const path = query ? `/photos?${query}` : '/photos';

  const response = await fetchWithAuth<FeedPhotosResponse>(
    path,
    {},
    { optionalAuth: true },
  );

  if (!response) throw new Error('사진 목록을 불러오지 못했습니다.');
  return response;
}

export async function updatePhotoLike(
  photoId: string,
  liked: boolean,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotoLikeResponse> {
  const method = liked ? 'PUT' : 'DELETE';
  const response = await fetchWithAuth<PhotoLikeResponse>(
    `/photos/${photoId}/like`,
    { method },
  );
  if (!response) throw new Error('좋아요 응답이 없습니다.');
  return response;
}
