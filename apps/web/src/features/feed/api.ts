//요청을 보내는 곳

import { apiFetch } from '@/lib/api';
import type { FeedPhotosParams, FeedPhotosResponse } from './types';

export async function getFeedPhotos(
  params: FeedPhotosParams,
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
