import type { useAuth } from '@/features/auth/context/AuthContext';
import type {
  ReservationDetailResponse,
  ReservationListParams,
  ReservationListResponse,
  ReservationDeliverableResponse,
  CreateReservationDeliverableInput,
  CreateReservationDeliverableResponse,
  UpdateReservationDeliverableInput,
  ConfirmReservationPurchaseResponse,
  CreateReservationCancelInput,
  CreateReservationCancelResponse,
  UpdateReservationCancelInput,
  UpdateReservationCancelResponse,
} from './types';

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

// 예약에 등록된 결과물 정보를 조회
export async function getReservationDeliverable(
  reservationId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<ReservationDeliverableResponse> {
  const path = `/me/reservations/${encodeURIComponent(reservationId)}/deliverable`;

  const response = await fetchWithAuth<ReservationDeliverableResponse>(path);

  if (!response) {
    throw new Error('결과물 정보를 불러오지 못했어요.');
  }

  return response;
}

// 사진작가가 촬영 완료 예약의 결과물을 최초 등록
export async function createReservationDeliverable(
  reservationId: string,
  input: CreateReservationDeliverableInput,
  fetchWithAuth: FetchWithAuth,
): Promise<CreateReservationDeliverableResponse> {
  const path = `/me/reservations/${encodeURIComponent(reservationId)}/deliverable`;

  const response = await fetchWithAuth<CreateReservationDeliverableResponse>(
    path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (!response) {
    throw new Error('결과물을 등록하지 못했어요.');
  }

  return response;
}

// 사진작가가 기존에 전달한 결과물 정보를 수정
export async function updateReservationDeliverable(
  reservationId: string,
  input: UpdateReservationDeliverableInput,
  fetchWithAuth: FetchWithAuth,
): Promise<ReservationDeliverableResponse> {
  const path = `/me/reservations/${encodeURIComponent(reservationId)}/deliverable`;

  const response = await fetchWithAuth<ReservationDeliverableResponse>(path, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response) {
    throw new Error('결과물을 수정하지 못했어요.');
  }

  return response;
}

// 로그인한 사용자의 예약 상세 정보를 조회
export async function getMyReservationDetail(
  reservationId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<ReservationDetailResponse> {
  const path = `/me/reservations/${encodeURIComponent(reservationId)}`;

  // 인증된 계정의 예약 상세 정보를 조회
  const response = await fetchWithAuth<ReservationDetailResponse>(path);

  if (!response) {
    throw new Error('예약 상세 정보를 불러오지 못했어요.');
  }

  return response;
}

// 일반 사용자가 결과물을 확인하고 구매를 확정
export async function confirmReservationPurchase(
  reservationId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<ConfirmReservationPurchaseResponse> {
  const path = `/me/reservations/${encodeURIComponent(reservationId)}/purchase-confirm`;

  const response = await fetchWithAuth<ConfirmReservationPurchaseResponse>(
    path,
    {
      method: 'PATCH',
    },
  );

  if (!response) {
    throw new Error('구매를 확정하지 못했어요.');
  }

  return response;
}

// 일반 사용자의 예약 취소 요청 및 사진작가의 직접 예약 취소
export async function createReservationCancel(
  reservationId: string,
  input: CreateReservationCancelInput,
  fetchWithAuth: FetchWithAuth,
): Promise<CreateReservationCancelResponse> {
  const path = `/me/reservations/${encodeURIComponent(reservationId)}/cancel`;

  const response = await fetchWithAuth<CreateReservationCancelResponse>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response) {
    throw new Error('예약 취소 요청을 처리하지 못했어요.');
  }

  return response;
}

// 사진작가가 고객의 예약 취소 요청을 수락하거나 반려
export async function updateReservationCancel(
  reservationId: string,
  cancelRequestId: string,
  input: UpdateReservationCancelInput,
  fetchWithAuth: FetchWithAuth,
): Promise<UpdateReservationCancelResponse> {
  const path = `/me/reservations/${encodeURIComponent(reservationId)}/cancel/${encodeURIComponent(cancelRequestId)}`;

  const response = await fetchWithAuth<UpdateReservationCancelResponse>(path, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response) {
    throw new Error('예약 취소 요청을 처리하지 못했어요.');
  }

  return response;
}
