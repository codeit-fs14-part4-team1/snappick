/**
 * apps/api/prisma/schema.prisma의 enum 이름과 값을 그대로 사용
 * 스키마의 enum이 변경되면 이 파일도 함께 수정
 * 공통 화면 표시 문구는 apps/web/src/constants/enum-labels.ts에서 관리
 */

export const AccountType = {
  USER: 'USER',
  PHOTOGRAPHER: 'PHOTOGRAPHER',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const Provider = {
  BASIC: 'BASIC',
  GOOGLE: 'GOOGLE',
  KAKAO: 'KAKAO',
  NAVER: 'NAVER',
} as const;
export type Provider = (typeof Provider)[keyof typeof Provider];

export const ReservationStatus = {
  CONFIRMED: 'CONFIRMED',
  SHOOT_COMPLETED: 'SHOOT_COMPLETED',
  DELIVERED: 'DELIVERED',
  PURCHASE_CONFIRMED: 'PURCHASE_CONFIRMED',
  CANCELED: 'CANCELED',
} as const;
export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const CancelStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;
export type CancelStatus = (typeof CancelStatus)[keyof typeof CancelStatus];

export const NotiType = {
  NEW_MESSAGE: 'NEW_MESSAGE',
  NEW_INQUIRY: 'NEW_INQUIRY',
  NEW_QUOTE: 'NEW_QUOTE',
  RESERVATION_CONFIRMED: 'RESERVATION_CONFIRMED',
  SHOOT_REMINDER: 'SHOOT_REMINDER',
  DELIVERY_COMPLETED: 'DELIVERY_COMPLETED',
  NEW_REVIEW: 'NEW_REVIEW',
  CANCEL_REQUESTED: 'CANCEL_REQUESTED',
  CANCEL_REJECTED: 'CANCEL_REJECTED',
  RESERVATION_CANCELED: 'RESERVATION_CANCELED',
} as const;
export type NotiType = (typeof NotiType)[keyof typeof NotiType];

export const NotiTargetType = {
  CHAT_ROOM: 'CHAT_ROOM',
  RESERVATION: 'RESERVATION',
  PHOTOGRAPHER_PROFILE: 'PHOTOGRAPHER_PROFILE',
} as const;
export type NotiTargetType =
  (typeof NotiTargetType)[keyof typeof NotiTargetType];

export const MessageType = {
  TEXT: 'TEXT',
  INITIAL_REQUEST: 'INITIAL_REQUEST',
  QUOTE: 'QUOTE',
  SYSTEM: 'SYSTEM',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const PaymentMethod = {
  EASY_PAY: 'EASY_PAY',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentProvider = {
  TOSS: 'TOSS',
} as const;
export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentStatus = {
  READY: 'READY',
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const Category = {
  WEDDING: 'WEDDING',
  COUPLE: 'COUPLE',
  FAMILY: 'FAMILY',
  FRIENDS: 'FRIENDS',
  GRADUATION: 'GRADUATION',
  PROFILE: 'PROFILE',
  EVENT: 'EVENT',
  PET: 'PET',
  ETC: 'ETC',
} as const;
export type Category = (typeof Category)[keyof typeof Category];

export const Style = {
  NATURAL: 'NATURAL',
  BRIGHT: 'BRIGHT',
  FILM: 'FILM',
  VINTAGE: 'VINTAGE',
  CINEMATIC: 'CINEMATIC',
  MONOCHROME: 'MONOCHROME',
  MINIMAL: 'MINIMAL',
  DREAMY: 'DREAMY',
} as const;
export type Style = (typeof Style)[keyof typeof Style];

export const Region = {
  SEOUL: 'SEOUL',
  DAEGU: 'DAEGU',
  GWANGJU: 'GWANGJU',
  ULSAN: 'ULSAN',
  GYEONGGI: 'GYEONGGI',
  CHUNGBUK: 'CHUNGBUK',
  JEONBUK: 'JEONBUK',
  GYEONGBUK: 'GYEONGBUK',
  JEJU: 'JEJU',
  BUSAN: 'BUSAN',
  INCHEON: 'INCHEON',
  DAEJEON: 'DAEJEON',
  SEJONG: 'SEJONG',
  GANGWON: 'GANGWON',
  CHUNGNAM: 'CHUNGNAM',
  JEONNAM: 'JEONNAM',
  GYEONGNAM: 'GYEONGNAM',
} as const;
export type Region = (typeof Region)[keyof typeof Region];
