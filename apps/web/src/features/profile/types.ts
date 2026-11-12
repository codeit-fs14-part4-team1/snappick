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

// GET /photographers/me/readiness

// 사진작가 프로필 준비 상태 응답 타입 정의
export type PhotographerReadinessResponse = {
  isReady: boolean;
  checks: Record<string, boolean>;
  missing: string[];
};
