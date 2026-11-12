'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import { updatePhotographerProfile } from '../api';
import type { UpdatePhotographerProfileInput } from '../types';

// 사진작가 본인의 기본 정보 수정을 처리함
export function useUpdatePhotographerProfile() {
  const { user, fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePhotographerProfileInput) => {
      // 사진작가 계정만 프로필을 수정할 수 있도록 확인함
      if (user?.accountType !== 'PHOTOGRAPHER') {
        throw new Error('사진작가만 프로필을 수정할 수 있어요.');
      }

      // 사진작가 본인의 기본 정보 수정 API를 호출함
      return updatePhotographerProfile(input, fetchWithAuth);
    },

    // 수정 성공 시 작가 관련 조회 데이터를 갱신함
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.photographers.all,
      });
    },
  });
}
