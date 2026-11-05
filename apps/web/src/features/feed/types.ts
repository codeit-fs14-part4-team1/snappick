import type { Category, Region, Style } from '@snappick/shared';

export const FEED_SORTS = ['random', 'latest', 'popular'] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export const KEYWORD_MAX_LENGTH = 50;

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
  liked: boolean;
};

export type FeedPhotosResponse = {
  items: FeedPhoto[];
  totalCount: number;
  seed: string | null;
  nextCursor: string | null;
};

export type FeedPhotosParams = {
  category?: Category;
  styles?: Style[];
  regions?: Region[];
  keyword?: string;
  sort?: FeedSort;
  seed?: string;
  cursor?: string;
  limit?: number;
};

export type PhotoLikeResponse = {
  photoId: string;
  liked: boolean;
  likeCount: number;
};
