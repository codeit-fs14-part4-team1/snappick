import { CancelStatus, Provider, ReservationStatus } from './enums';

export const ProviderLabel = {
  [Provider.BASIC]: '이메일',
  [Provider.GOOGLE]: 'Google',
  [Provider.KAKAO]: '카카오',
  [Provider.NAVER]: '네이버',
} as const satisfies Record<Provider, string>;

export const ReservationStatusLabel = {
  [ReservationStatus.CONFIRMED]: '예약 확정',
  [ReservationStatus.SHOOT_COMPLETED]: '촬영 완료',
  [ReservationStatus.DELIVERED]: '결과물 전달',
  [ReservationStatus.PURCHASE_CONFIRMED]: '구매 확정',
  [ReservationStatus.CANCELED]: '예약 취소',
} as const satisfies Record<ReservationStatus, string>;

//시안에서 표시가 확인된 PENDING만 제공
export const CancelStatusLabel = {
  [CancelStatus.PENDING]: '취소 요청 중',
} as const satisfies Partial<Record<CancelStatus, string>>;
