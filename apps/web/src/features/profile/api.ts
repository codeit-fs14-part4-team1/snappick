import type { useAuth } from '@/features/auth/context/AuthContext';
import type {
  PhotographerProfile,
  PhotographerProductsResponse,
  PhotographerReviewsParams,
  PhotographerReviewsResponse,
  PhotographerReviewSummaryResponse,
  UpdatePhotographerProfileInput,
  PhotographerReadinessResponse,
  CreatePhotographerProductInput,
  PhotographerProduct,
  UpdatePhotographerProductInput,
} from './types';

type FetchWithAuth = ReturnType<typeof useAuth>['fetchWithAuth'];

// 공개 작가 프로필을 조회함
export async function getPhotographerProfile(
  photographerId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerProfile> {
  const response = await fetchWithAuth<PhotographerProfile>(
    `/photographers/${photographerId}`,
    {},
    { optionalAuth: true },
  );

  if (!response) {
    throw new Error('작가 프로필을 불러오지 못했어요');
  }

  return response;
}

// 공개 작가의 촬영 상품 목록을 조회함
export async function getPhotographerProducts(
  photographerId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerProductsResponse> {
  const response = await fetchWithAuth<PhotographerProductsResponse>(
    `/photographers/${photographerId}/products`,
    {},
    { optionalAuth: true },
  );

  if (!response) {
    throw new Error('촬영 상품을 불러오지 못했어요');
  }

  return response;
}

// 공개 작가의 리뷰 목록을 페이지별로 조회함
export async function getPhotographerReviews(
  photographerId: string,
  params: PhotographerReviewsParams,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerReviewsResponse> {
  // 페이지 번호와 페이지당 리뷰 개수를 쿼리 파라미터로 변환함
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }

  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }

  const query = searchParams.toString();

  const path = query
    ? `/photographers/${photographerId}/reviews?${query}`
    : `/photographers/${photographerId}/reviews`;

  // 비회원도 조회할 수 있도록 선택적 인증을 사용함
  const response = await fetchWithAuth<PhotographerReviewsResponse>(
    path,
    {},
    { optionalAuth: true },
  );

  if (!response) {
    throw new Error('작가 리뷰를 불러오지 못했어요.');
  }

  return response;
}

// 공개 사진작가의 AI 리뷰 요약을 조회함
export async function getPhotographerReviewSummary(
  photographerId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerReviewSummaryResponse> {
  // 비회원도 조회할 수 있도록 선택적 인증을 사용함
  const response = await fetchWithAuth<PhotographerReviewSummaryResponse>(
    `/photographers/${photographerId}/reviews/summary`,
    {},
    { optionalAuth: true },
  );

  if (!response) {
    throw new Error('AI 리뷰 요약을 불러오지 못했어요.');
  }

  return response;
}

// 작가 저장 및 저장 취소 API 응답 타입 정의
type PhotographerSaveResponse = {
  photographerId: string;
  saved: boolean;
};

// 일반 사용자가 사진작가를 저장함
export async function savePhotographer(
  photographerId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerSaveResponse> {
  const response = await fetchWithAuth<PhotographerSaveResponse>(
    `/photographers/${photographerId}/save`,
    { method: 'PUT' },
  );

  if (!response) {
    throw new Error('작가를 저장하지 못했어요.');
  }

  return response;
}

// 일반 사용자가 사진작가 저장을 취소함
export async function unsavePhotographer(
  photographerId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerSaveResponse> {
  const response = await fetchWithAuth<PhotographerSaveResponse>(
    `/photographers/${photographerId}/save`,
    { method: 'DELETE' },
  );

  if (!response) {
    throw new Error('작가 저장을 취소하지 못했어요.');
  }

  return response;
}

// 사진작가 본인의 기본 정보를 수정함
export async function updatePhotographerProfile(
  input: UpdatePhotographerProfileInput,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerProfile> {
  const response = await fetchWithAuth<PhotographerProfile>(
    '/photographers/me',
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (!response) {
    throw new Error('작가 프로필을 수정하지 못했어요.');
  }

  return response;
}

// 프로필 이미지 업로드 URL 발급 API 응답 타입을 정의함
type ProfileImageUploadUrlResponse = {
  uploadKey: string;
  uploadUrl: string;
  expiresAt: string;
};

// 프로필 이미지 저장 API 응답 타입을 정의함
type ProfileImageUpdateResponse = {
  profileImageUrl: string;
};

// 프로필 이미지 최대 파일 크기를 5MB로 제한함
const PROFILE_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

// 사진작가 본인의 프로필 이미지를 서버에 업로드하고 저장함
export async function savePhotographerProfileImage(
  file: File,
  fetchWithAuth: FetchWithAuth,
): Promise<ProfileImageUpdateResponse> {
  // 서버에서 허용하는 이미지 형식만 업로드함
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('JPG, PNG, WebP 이미지 파일만 선택할 수 있어요.');
  }

  // 빈 파일 및 5MB 초과 파일의 업로드를 차단함
  if (file.size === 0) {
    throw new Error('빈 파일은 업로드할 수 없어요.');
  }

  if (file.size > PROFILE_IMAGE_MAX_FILE_SIZE) {
    throw new Error('프로필 이미지는 5MB 이하만 업로드할 수 있어요.');
  }

  // 서버에서 이미지 업로드 URL을 발급받음
  const uploadTarget = await fetchWithAuth<ProfileImageUploadUrlResponse>(
    '/me/profile-image/upload-url',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: file.type,
        fileSize: file.size,
      }),
    },
  );

  if (!uploadTarget) {
    throw new Error('이미지 업로드 주소를 발급받지 못했어요.');
  }

  // 발급받은 URL로 이미지 파일을 직접 업로드함
  const uploadResponse = await fetch(uploadTarget.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('프로필 이미지를 업로드하지 못했어요.');
  }

  // 업로드한 이미지를 본인의 프로필 이미지로 저장함
  const response = await fetchWithAuth<ProfileImageUpdateResponse>(
    '/me/profile-image',
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadKey: uploadTarget.uploadKey,
      }),
    },
  );

  if (!response) {
    throw new Error('프로필 이미지를 저장하지 못했어요.');
  }

  return response;
}

// 사진작가 본인의 프로필 준비 상태를 조회함
export async function getPhotographerReadiness(
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerReadinessResponse> {
  const response = await fetchWithAuth<PhotographerReadinessResponse>(
    '/photographers/me/readiness',
  );

  if (!response) {
    throw new Error('프로필 준비 상태를 불러오지 못했어요.');
  }

  return response;
}

// 사진작가 본인의 촬영 상품을 등록함
export async function createPhotographerProduct(
  input: CreatePhotographerProductInput,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerProduct> {
  const response = await fetchWithAuth<PhotographerProduct>(
    '/photographers/me/products',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (!response) {
    throw new Error('촬영 상품을 등록하지 못했어요.');
  }

  return response;
}

// 사진작가 본인의 촬영 상품을 수정함
export async function updatePhotographerProduct(
  productId: string,
  input: UpdatePhotographerProductInput,
  fetchWithAuth: FetchWithAuth,
): Promise<PhotographerProduct> {
  const response = await fetchWithAuth<PhotographerProduct>(
    `/photographers/me/products/${productId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (!response) {
    throw new Error('촬영 상품을 수정하지 못했어요.');
  }

  return response;
}

// 사진작가 본인의 촬영 상품을 삭제함
export async function deletePhotographerProduct(
  productId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<void> {
  await fetchWithAuth<void>(`/photographers/me/products/${productId}`, {
    method: 'DELETE',
  });
}

// 사진작가 리뷰 답글 작성 및 수정 요청 타입을 정의함
export type PhotographerReplyInput = {
  comment: string;
};

// 사진작가가 본인 프로필의 리뷰에 답글을 작성함
export async function createPhotographerReviewReply(
  reviewId: string,
  input: PhotographerReplyInput,
  fetchWithAuth: FetchWithAuth,
): Promise<void> {
  const response = await fetchWithAuth<unknown>(
    `/photographers/me/reviews/${reviewId}/reply`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (response == null) {
    throw new Error('리뷰 답글을 작성하지 못했어요.');
  }
}

// 사진작가가 기존 리뷰 답글을 수정함
export async function updatePhotographerReviewReply(
  reviewId: string,
  input: PhotographerReplyInput,
  fetchWithAuth: FetchWithAuth,
): Promise<void> {
  const response = await fetchWithAuth<unknown>(
    `/photographers/me/reviews/${reviewId}/reply`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (response == null) {
    throw new Error('리뷰 답글을 수정하지 못했어요.');
  }
}

// 사진작가가 기존 리뷰 답글을 삭제함
export async function deletePhotographerReviewReply(
  reviewId: string,
  fetchWithAuth: FetchWithAuth,
): Promise<void> {
  await fetchWithAuth<void>(`/photographers/me/reviews/${reviewId}/reply`, {
    method: 'DELETE',
  });
}
