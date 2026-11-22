import type { useAuth } from '@/features/auth/context/AuthContext';
import type { ReservationListParams, ReservationListResponse } from './types';

type FetchWithAuth = ReturnType<typeof useAuth>['fetchWithAuth'];

// 로그인한 사용자의 예약 목록을 조회
export async function getMyReservations(
  params: ReservationListParams,
  fetchWithAuth: FetchWithAuth,
): Promise<ReservationListResponse> {
  const searchParams = new URLSearchParams();

  // 서버에서 지원하는 예약 상태 필터를 설정
  if (params.type) {
    searchParams.set('type', params.type);
  }

  // 서버 페이지네이션 파라미터를 설정
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }

  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }

  const queryString = searchParams.toString();

  const path = `/me/reservations${queryString ? `?${queryString}` : ''}`;

  // 인증된 계정의 예약 목록을 조회
  const response = await fetchWithAuth<ReservationListResponse>(path);

  if (!response) {
    throw new Error('예약 내역을 불러오지 못했어요.');
  }

  return response;
}
