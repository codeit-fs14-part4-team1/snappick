import type { Category, Region, Style } from '@snappick/shared';

//탐색 정렬 기준 (서버 기본값: random)
export type FeedSort = 'random' | 'latest' | 'popular';

//사진의 타입
export type FeedPhoto = {
  photoId: string;
  imageUrl: string;
  width: number;
  height: number;
  photographer: {
    id: string;
    nickname: string;
  };
  likeCount: number;
  liked: boolean; //비로그인·작가 계정이면 항상 false
};

//한 페이지의 응답의 타입
export type FeedPhotosResponse = {
  items: FeedPhoto[];
  totalCount: number;
  seed: string | null; //random이 아니면 null
  nextCursor: string | null; //마지막 페이지면 null
};

//요청 파라미터 타입
//생략하면 서버 기본값 적용 (sort: random, limit: 20)
export type FeedPhotosParams = {
  category?: Category;
  styles?: Style[];
  regions?: Region[];
  keyword?: string;
  sort?: FeedSort;
  seed?: string; //random일 때만 전달
  cursor?: string; //첫 페이지는 생략
  limit?: number;
};
