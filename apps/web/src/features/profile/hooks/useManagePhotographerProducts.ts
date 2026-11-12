'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import {
  createPhotographerProduct,
  updatePhotographerProduct,
  deletePhotographerProduct,
} from '../api';

import type { CreatePhotographerProductInput } from '../types';

// 상품 등록 또는 수정에 필요한 데이터 타입 정의
type SaveProductParams = {
  productId?: string;
  input: CreatePhotographerProductInput;
};

// 사진작가 본인의 촬영 상품 등록·수정·삭제를 처리함
export function useManagePhotographerProducts() {
  const { user, fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  // 상품 변경 후 목록과 프로필 준비 상태를 갱신함
  const invalidateProductQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.photographers.all,
      }),
    ]);
  };

  // 상품 등록과 수정을 처리함
  const saveMutation = useMutation({
    mutationFn: ({ productId, input }: SaveProductParams) => {
      if (user?.accountType !== 'PHOTOGRAPHER') {
        throw new Error('사진작가만 촬영 상품을 관리할 수 있어요.');
      }

      return productId
        ? updatePhotographerProduct(productId, input, fetchWithAuth)
        : createPhotographerProduct(input, fetchWithAuth);
    },

    onSuccess: invalidateProductQueries,
  });

  // 상품 삭제를 처리함
  const deleteMutation = useMutation({
    mutationFn: (productId: string) => {
      if (user?.accountType !== 'PHOTOGRAPHER') {
        throw new Error('사진작가만 촬영 상품을 삭제할 수 있어요.');
      }

      return deletePhotographerProduct(productId, fetchWithAuth);
    },

    onSuccess: invalidateProductQueries,
  });

  return {
    saveMutation,
    deleteMutation,
  };
}
