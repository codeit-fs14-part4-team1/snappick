'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import { getPhotographerReadiness } from '../api';

// 사진작가 본인의 프로필 준비 상태를 조회함
export function usePhotographerReadiness(enabled: boolean) {
  const { user, authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    queryKey: queryKeys.photographers.readiness(),

    queryFn: () => getPhotographerReadiness(fetchWithAuth),

    // 로그인한 사진작가가 편집 중일 때만 조회함
    enabled:
      enabled &&
      authStatus === 'authenticated' &&
      user?.accountType === 'PHOTOGRAPHER',
  });
}
