import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { getPhotographerProfile } from '../api';

// 공개 작가 프로필을 조회함
export function usePhotographerProfile(photographerId: string | undefined) {
  const { user, authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    queryKey: queryKeys.photographers.detail(
      photographerId ?? '',
      user ? user.id : null,
    ),

    queryFn: () => getPhotographerProfile(photographerId!, fetchWithAuth),

    // 인증 초기화가 끝났고 작가 id가 있을 때 조회함
    enabled: authStatus !== 'initializing' && !!photographerId,
  });
}
