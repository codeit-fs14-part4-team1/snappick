import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import { createReservationCancel, updateReservationCancel } from '../api';

import type {
  CreateReservationCancelInput,
  UpdateReservationCancelInput,
} from '../types';

// 일반 사용자의 취소 요청 및 사진작가의 직접 예약 취소
export function useCreateReservationCancel(reservationId: string) {
  const { fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReservationCancelInput) =>
      createReservationCancel(
        reservationId,
        {
          reason: input.reason.trim(),
        },
        fetchWithAuth,
      ),

    // 취소 요청 또는 직접 취소 성공 후 예약 상세와 목록을 갱신
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.reservations.detail(reservationId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.reservations.listAll(),
        }),
      ]);
    },
  });
}

// 사진작가의 고객 취소 요청 수락 및 반려
export function useUpdateReservationCancel(reservationId: string) {
  const { fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cancelRequestId,
      input,
    }: {
      cancelRequestId: string;
      input: UpdateReservationCancelInput;
    }) =>
      updateReservationCancel(
        reservationId,
        cancelRequestId,
        input.status === 'ACCEPTED'
          ? {
              status: 'ACCEPTED',
              reason: input.reason.trim(),
            }
          : {
              status: 'REJECTED',
            },
        fetchWithAuth,
      ),

    // 취소 요청 수락 또는 반려 성공 후 예약 상세와 목록을 갱신
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.reservations.detail(reservationId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.reservations.listAll(),
        }),
      ]);
    },
  });
}
