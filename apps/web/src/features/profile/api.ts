import type { useAuth } from '@/features/auth/context/AuthContext';
import type {
  PhotographerProfile,
  PhotographerProductsResponse,
  PhotographerReviewsParams,
  PhotographerReviewsResponse,
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
