import type { Category, Style } from '@snappick/shared';

//GET /photos/{photoId}
export type PhotoDetail = {
  photoId: string;
  imageUrl: string;
  width: number;
  height: number;
  categories: Category[];
  styles: Style[];
  keywords: string[];
  description: string | null;
  likeCount: number;
  liked: boolean;
  createdAt: string;
  photographer: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
    ratingAvg: number | null; //리뷰 0개면 null
    reviewCount: number;
    saved: boolean; //비회원·작가 계정은 항상 false
  };
};

//GET /photographers/{photographerId}/photos
export type PhotographerPhoto = {
  photoId: string;
  imageUrl: string;
  width: number;
  height: number;
  likeCount: number;
  liked: boolean;
  isRepresentative: boolean;
};

export type PhotographerPhotosResponse = {
  items: PhotographerPhoto[];
  totalCount: number;
  nextCursor: string | null;
};

export type PhotographerPhotosParams = {
  excludePhotoId?: string; //상세 모달에 띄운 사진 1장 제외
  cursor?: string;
  limit?: number;
};
