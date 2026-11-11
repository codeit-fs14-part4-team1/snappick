import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { getPhotographerProducts } from '../api';

// 특정 작가의 촬영 상품 목록을 조회함
export function usePhotographerProducts(photographerId: string | undefined) {
  const { authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    queryKey: queryKeys.products.list(photographerId ?? ''),

    // 기존 공통 인증 요청 함수를 사용해 상품 목록을 조회함
    queryFn: () => getPhotographerProducts(photographerId!, fetchWithAuth),

    // 인증 초기화 완료 후 유효한 작가 ID가 있을 때 조회함
    enabled: authStatus !== 'initializing' && !!photographerId,
  });
}
