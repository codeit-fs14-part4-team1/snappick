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

// 예약 상세에서 표시할 사진작가 정보를 정의
export type ReservationDetailPhotographer = ReservationCounterpart & {
  photographerId: string;
};

// 예약 상세에서 표시할 일반 사용자 정보를 정의
export type ReservationDetailUser = ReservationCounterpart & {
  userId: string;
};

// 가장 최근 예약 취소 요청 정보를 정의
export type ReservationCancelRequest = {
  cancelRequestId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  userReason: string | null;
  photographerReason: string | null;
  requestedByMe: boolean;
  requestedAt: string;
  processedAt: string | null;
};

// 예약 상세 조회에 포함되는 견적 정보를 정의
export type ReservationDetailQuote = {
  name: string;
  includesOriginal: boolean;
  additionalNotice: string | null;
  commonNotice: string | null;
  chatRoomId: string | null;
};

// 예약 상세 조회에 포함되는 결제 정보를 정의
export type ReservationDetailPayment = {
  paymentMethod: 'EASY_PAY';
  paymentProvider: 'TOSS';
  paidAt: string | null;
};

// 예약 상세 조회 API의 응답 구조를 정의
export type ReservationDetailResponse = {
  reservationId: string;
  reservationNumber: string;
  quote: ReservationDetailQuote | null;
  status: ReservationStatus;
  shootAt: string;
  location: string;
  locationCoords: ReservationLocationCoords | null;
  durationMinutes: number | null;
  photoCount: number | null;
  deliveryDueDate: string | null;
  totalAmount: number;
  payment: ReservationDetailPayment | null;
  createdAt: string;
  deliveredAt: string | null;
  purchaseConfirmedAt: string | null;
  photographer?: ReservationDetailPhotographer | null;
  user?: ReservationDetailUser | null;
  cancelRequest: ReservationCancelRequest | null;
  canRequestCancel: boolean;
};

// 결과물 조회 및 수정 API의 공통 응답 구조를 정의
export type ReservationDeliverableResponse = {
  deliverableId: string;
  reservationId: string;
  link: string;
  expirationPeriod: string;
  notice: string | null;
  createdAt: string;
  updatedAt: string;
};

// 결과물 최초 등록 API의 요청 구조를 정의
export type CreateReservationDeliverableInput = {
  link: string;
  expirationPeriod: string;
  notice?: string;
};

// 결과물 최초 등록 API의 응답 구조를 정의
export type CreateReservationDeliverableResponse =
  ReservationDeliverableResponse & {
    reservationStatus: 'DELIVERED';
  };

// 기존 결과물 수정 API의 요청 구조를 정의
export type UpdateReservationDeliverableInput = {
  link?: string;
  expirationPeriod?: string;
  notice?: string | null;
};

// 일반 사용자의 구매 확정 API 응답 구조를 정의
export type ConfirmReservationPurchaseResponse = {
  reservationId: string;
  status: 'PURCHASE_CONFIRMED';
  purchaseConfirmedAt: string;
};

// 예약에 연결된 촬영 장소의 지도 좌표를 정의
export type ReservationLocationCoords = {
  lat: number;
  lng: number;
};

// 일반 사용자 취소 요청 및 사진작가 직접 취소의 요청 구조를 정의
export type CreateReservationCancelInput = {
  reason: string;
};

// 일반 사용자 취소 요청 및 사진작가 직접 취소의 응답 구조를 정의
export type CreateReservationCancelResponse = {
  cancelRequestId: string;
  status: 'PENDING' | 'ACCEPTED';
  reason: string;
  requestedAt: string;
  processedAt: string | null;
};

// 사진작가의 취소 요청 수락 및 반려 요청 구조를 정의
export type UpdateReservationCancelInput =
  | {
      status: 'ACCEPTED';
      reason: string;
    }
  | {
      status: 'REJECTED';
    };

// 사진작가의 취소 요청 수락 및 반려 응답 구조를 정의
export type UpdateReservationCancelResponse = {
  cancelRequestId: string;
  status: 'ACCEPTED' | 'REJECTED';
  userReason: string;
  photographerReason: string | null;
  processedAt: string | null;
  reservationStatus: ReservationStatus;
};
