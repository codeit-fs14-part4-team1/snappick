import type { Category, Region } from '@snappick/shared';

// GET /photographers/{photographerId}
export type PhotographerProfile = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  career: number | null;
  regions: Region[];
  categories: Category[];
  introduction: string | null;
  ratingAvg: number | null;
  reviewCount: number;

  // 작가 저장 수와 구매 확정된 예약 건수를 정의함
  savedCount: number;
  completedCount: number;

  saved: boolean;
  isSelf: boolean;
  isReady: boolean;
};

// PATCH /photographers/me
// 사진작가 본인 프로필 수정 요청 타입 정의
export type UpdatePhotographerProfileInput = {
  nickname?: string;
  career?: number;
  regions?: Region[];
  categories?: Category[];
  introduction?: string | null;
};

// GET /photographers/{photographerId}/products

// 촬영 상품 데이터 타입 정의
export type PhotographerProduct = {
  productId: string;
  name: string;
  price: number;
  durationMinutes: number;
  photoCount: number;
  includesOriginal: boolean;
  commonNotice: string | null;
};

// POST /photographers/me/products

// 촬영 상품 등록 요청 타입 정의
export type CreatePhotographerProductInput = Pick<
  PhotographerProduct,
  | 'name'
  | 'price'
  | 'durationMinutes'
  | 'photoCount'
  | 'includesOriginal'
  | 'commonNotice'
>;

// PATCH /photographers/me/products/:productId

// 촬영 상품 수정 요청 타입 정의
export type UpdatePhotographerProductInput =
  Partial<CreatePhotographerProductInput>;

// 촬영 상품 목록 API 응답 타입 정의
export type PhotographerProductsResponse = {
  items: PhotographerProduct[];
};

// GET /photographers/{photographerId}/reviews

// 리뷰에 등록된 작가 답글 타입 정의
export type PhotographerReviewReply = {
  replyId: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

// 리뷰 한 건의 API 응답 타입 정의
export type PhotographerReviewItem = {
  reviewId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  author: {
    nickname: string;
    profileImageUrl: string | null;
  } | null;
  reply: PhotographerReviewReply | null;
};

// 리뷰 목록 조회 요청 파라미터 정의
export type PhotographerReviewsParams = {
  page?: number;
  pageSize?: number;
};

// 리뷰 목록 API 응답 타입 정의
export type PhotographerReviewsResponse = {
  items: PhotographerReviewItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

// GET /photographers/{photographerId}/reviews/summary

// AI 리뷰 요약의 생성 및 조회 상태를 정의
export type PhotographerReviewSummaryStatus =
  'READY' | 'UPDATING' | 'NOT_ENOUGH' | 'UNAVAILABLE';

// AI 리뷰 요약의 주요 키워드와 해당 키워드를 언급한 리뷰 수를 정의
export type PhotographerReviewSummaryHighlight = {
  label: string;
  count: number;
};

// AI 리뷰 요약에서 반복적으로 언급된 아쉬운 점과 해당 리뷰 수를 정의
export type PhotographerReviewSummaryCaution = {
  text: string;
  count: number;
};

// 사진작가 AI 리뷰 요약 API 응답 타입을 정의
export type PhotographerReviewSummaryResponse = {
  photographerId: string;
  status: PhotographerReviewSummaryStatus;
  summary: string | null;
  highlights: PhotographerReviewSummaryHighlight[];
  caution: PhotographerReviewSummaryCaution | null;
  sourceReviewCount: number;
  generatedAt: string | null;
};

// GET /photographers/me/readiness

// 사진작가 프로필 준비 상태 응답 타입을 정의함
export type PhotographerReadinessResponse = {
  isReady: boolean;
  checks: Record<string, boolean>;
  missing: string[];
};
