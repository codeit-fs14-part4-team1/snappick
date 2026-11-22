import type { ReservationStatus } from '@snappick/shared';

// 예약 목록 조회 API에서 지원하는 필터를 정의
export type ReservationListFilter =
  'ALL' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

// 예약 목록 조회 요청의 쿼리 파라미터를 정의
export type ReservationListParams = {
  type?: ReservationListFilter;
  page?: number;
  pageSize?: number;
};

// 예약 상대방의 기본 정보를 정의
export type ReservationCounterpart = {
  nickname: string;
  profileImageUrl: string | null;
};

// 예약 목록에 표시할 예약 정보를 정의
export type ReservationListItem = {
  reservationId: string;
  name: string | null;
  counterpart: ReservationCounterpart | null;
  status: ReservationStatus;
  cancelRequestStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | null;
  shootAt: string;
  location: string;
  totalAmount: number;
  createdAt: string;
};

// 예약 목록 조회 API의 응답 구조를 정의
export type ReservationListResponse = {
  items: ReservationListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};
