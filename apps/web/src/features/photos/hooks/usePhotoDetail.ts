//사진 상세 조회 (상세 모달) — photoId가 null이면 조회하지 않음

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getPhotoDetail } from '../api';

export function usePhotoDetail(photoId: string | null) {
  const { user, authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    queryKey: queryKeys.photos.detail(photoId ?? '', user ? user.id : null),

    queryFn: () => getPhotoDetail(photoId!, fetchWithAuth),

    enabled: authStatus !== 'initializing' && !!photoId,
  });
}
