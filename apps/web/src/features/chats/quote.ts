import type { ReservationStatus } from '@snappick/shared';

/** 상품 조회 결과를 화면 연결부에서 변환해 전달합니다. */
export type QuoteProduct = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  photoCount: number;
  includesOriginal: boolean;
  commonNotice: string | null;
};

/** 견적 전송 API 연결 시 요청 모델로 변환합니다. */
export type QuoteDraft = {
  productId: string;
  quoteName: string;
  price: number;
  durationMinutes: number;
  date: string;
  startTime: string;
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  photoCount: number | null;
  includesOriginal: boolean;
  additionalNotice: string | null;
  commonNotice: string;
};

/** 견적 생성·상세 조회·QUOTE 메시지에 포함되는 공통 응답입니다. */
export type Quote = {
  id: string;
  chatRoomId: string;
  shootingCaseId: string;
  version: number;
  isLatest: boolean;
  reservationStatus?: ReservationStatus | null;
  reservationId?: string | null;
  quoteName: string;
  shootAt: string;
  location: string;
  locationLat: number;
  locationLng: number;
  durationMinutes: number;
  price: number;
  photoCount: number | null;
  includesOriginal: boolean;
  additionalNotice: string | null;
  commonNotice: string | null;
  createdAt: string;
};

export type CreateQuoteInput = {
  chatRoomId: string;
  shootingCaseId?: string;
  expectedVersion?: number;
  productId?: string;
  quoteName: string;
  shootAt: string;
  location: string;
  locationLat: number;
  locationLng: number;
  durationMinutes: number;
  price: number;
  photoCount?: number | null;
  includesOriginal: boolean;
  additionalNotice?: string | null;
};

export function toQuoteDraft(quote: Quote): QuoteDraft {
  const local = new Date(
    Date.parse(quote.shootAt) + 9 * 60 * 60 * 1000,
  ).toISOString();
  return {
    productId: '',
    quoteName: quote.quoteName,
    price: quote.price,
    durationMinutes: quote.durationMinutes,
    date: local.slice(0, 10),
    startTime: local.slice(11, 16),
    location: quote.location,
    locationLat: quote.locationLat ?? null,
    locationLng: quote.locationLng ?? null,
    photoCount: quote.photoCount,
    includesOriginal: quote.includesOriginal,
    additionalNotice: quote.additionalNotice,
    commonNotice: quote.commonNotice ?? '',
  };
}

export function createQuoteInput(
  roomId: string,
  draft: QuoteDraft,
  shootingCaseId?: string,
  expectedVersion?: number,
): CreateQuoteInput {
  if (draft.locationLat === null || draft.locationLng === null)
    throw new Error('지도에서 촬영 장소를 선택해 주세요.');
  return {
    chatRoomId: roomId,
    ...(shootingCaseId && { shootingCaseId }),
    ...(shootingCaseId && { expectedVersion }),
    ...(draft.productId && { productId: draft.productId }),
    quoteName: draft.quoteName,
    // 브라우저의 시간대와 관계없이 촬영 시작 시간은 한국 시간으로 전송합니다.
    shootAt: new Date(
      `${draft.date}T${draft.startTime}:00+09:00`,
    ).toISOString(),
    location: draft.location,
    locationLat: draft.locationLat,
    locationLng: draft.locationLng,
    durationMinutes: draft.durationMinutes,
    price: draft.price,
    photoCount: draft.photoCount,
    includesOriginal: draft.includesOriginal,
    additionalNotice: draft.additionalNotice,
  };
}

export function getQuoteDeliveryDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const day = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(day.getTime())) return '';
  day.setUTCDate(day.getUTCDate() + 14);
  return day.toISOString().slice(0, 10).replaceAll('-', '.');
}

export function formatQuoteDate(date: string) {
  if (!date) return '';
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return `${date.replaceAll('-', '.')} (${'일월화수목금토'[day]})`;
}

export function formatQuoteTime(time: string) {
  if (!time) return '';
  const [hour, minute] = time.split(':');
  return `${Number(hour) < 12 ? '오전' : '오후'} ${Number(hour) % 12 || 12}:${minute}`;
}
