'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import { savePhotographer, unsavePhotographer } from '../api';

// 작가 저장 상태 변경에 필요한 데이터 타입 정의
type TogglePhotographerSaveParams = {
  photographerId: string;
  saved: boolean;
};

// 현재 저장 상태에 따라 저장 또는 저장 취소를 처리함
export function useTogglePhotographerSave() {
  const { user, fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photographerId, saved }: TogglePhotographerSaveParams) => {
      // 일반 사용자만 작가 저장 기능을 사용할 수 있도록 확인함
      if (user?.accountType !== 'USER') {
        throw new Error('일반 사용자만 작가를 저장할 수 있어요.');
      }

      // 저장 상태에 따라 저장 또는 저장 취소 API를 호출함
      return saved
        ? unsavePhotographer(photographerId, fetchWithAuth)
        : savePhotographer(photographerId, fetchWithAuth);
    },

    // 저장 상태 변경 성공 시 작가 관련 조회 데이터를 갱신함
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.photographers.all,
      });
    },
  });
}
