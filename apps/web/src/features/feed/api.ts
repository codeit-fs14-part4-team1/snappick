//'/photos'
//'/photos/{photoId}/like'

import { apiFetch } from '@/lib/api';
import { authFetch } from '@/features/auth/authFetch';
import type {
  FeedPhotosParams,
  FeedPhotosResponse,
  PhotoLikeResponse,
} from './types';

export async function getFeedPhotos(
  params: FeedPhotosParams,
  accessToken: string | null,
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

  const response = await apiFetch<FeedPhotosResponse>(path);

  if (!response) throw new Error('사진 목록을 불러오지 못했습니다.');
  return response;
}
