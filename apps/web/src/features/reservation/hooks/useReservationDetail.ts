import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { getMyReservationDetail } from '../api';

// 로그인한 사용자의 예약 상세 정보를 예약 ID별로 조회
export function useReservationDetail(reservationId: string) {
  const { authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    // 예약 ID에 따라 상세 조회 캐시를 구분
    queryKey: queryKeys.reservations.detail(reservationId),

    // 기존 인증 요청 함수를 사용하여 예약 상세 정보를 조회
    queryFn: () => getMyReservationDetail(reservationId, fetchWithAuth),

    // 인증 초기화가 완료되고 예약 ID가 있을 때만 조회
    enabled: authStatus !== 'initializing' && Boolean(reservationId),
  });
}
