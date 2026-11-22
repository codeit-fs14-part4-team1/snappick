import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { getMyReservations } from '../api';
import type { ReservationListParams } from '../types';

// 로그인한 사용자의 예약 목록을 필터와 페이지별로 조회
export function useMyReservations(params: ReservationListParams = {}) {
  const { authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    // 예약 상태 필터와 페이지 조건에 따라 캐시를 구분
    queryKey: queryKeys.reservations.list(params),

    // 기존 인증 요청 함수를 사용하여 예약 목록을 조회
    queryFn: () => getMyReservations(params, fetchWithAuth),

    // 인증 초기화가 완료된 후 예약 목록을 조회
    enabled: authStatus !== 'initializing',
  });
}
