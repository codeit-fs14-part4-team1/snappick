import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import { confirmReservationPurchase } from '../api';

// 일반 사용자가 결과물을 확인하고 구매를 확정
export function useConfirmReservationPurchase(reservationId: string) {
  const { fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    // 기존 구매 확정 API를 호출
    mutationFn: () => confirmReservationPurchase(reservationId, fetchWithAuth),

    // 구매 확정 성공 후 예약 상세 및 목록 캐시를 갱신
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
