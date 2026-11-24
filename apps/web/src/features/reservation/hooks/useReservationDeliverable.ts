import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

import {
  getReservationDeliverable,
  createReservationDeliverable,
  updateReservationDeliverable,
} from '../api';

import type {
  CreateReservationDeliverableInput,
  UpdateReservationDeliverableInput,
} from '../types';

// 예약에 등록된 결과물 정보를 조회
export function useReservationDeliverable(
  reservationId: string,
  enabled = true,
) {
  const { authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    queryKey: queryKeys.reservations.deliverable(reservationId),

    queryFn: () => getReservationDeliverable(reservationId, fetchWithAuth),

    // 인증된 계정에서 결과물 조회가 필요한 경우에만 요청
    enabled:
      authStatus === 'authenticated' && Boolean(reservationId) && enabled,
  });
}

// 사진작가가 촬영 완료 예약의 결과물을 최초 등록
export function useCreateReservationDeliverable(reservationId: string) {
  const { fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReservationDeliverableInput) =>
      createReservationDeliverable(reservationId, input, fetchWithAuth),

    onSuccess: async (response) => {
      const deliverable = {
        deliverableId: response.deliverableId,
        reservationId: response.reservationId,
        link: response.link,
        expirationPeriod: response.expirationPeriod,
        notice: response.notice,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      };
      // 등록에 성공한 결과물 정보를 조회 캐시에 반영
      queryClient.setQueryData(
        queryKeys.reservations.deliverable(reservationId),
        deliverable,
      );

      // 결과물 전달로 변경된 예약 상태를 다시 조회
      // 예약 목록의 모든 필터와 페이지도 함께 갱신
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

// 사진작가가 기존에 전달한 결과물 정보를 수정
export function useUpdateReservationDeliverable(reservationId: string) {
  const { fetchWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateReservationDeliverableInput) =>
      updateReservationDeliverable(reservationId, input, fetchWithAuth),

    onSuccess: (deliverable) => {
      // 수정에 성공한 최신 결과물 정보를 조회 캐시에 반영
      queryClient.setQueryData(
        queryKeys.reservations.deliverable(reservationId),
        deliverable,
      );
    },
  });
}
