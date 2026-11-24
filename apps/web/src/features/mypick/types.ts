import type { Category, Region } from '@snappick/shared';

export type MyPickParams = {
  cursor?: string | undefined;
  limit?: number;
};

export type LikedPhoto = {
  photoId: string;
  imageUrl: string;
  width: number;
  height: number;
  photographer: { id: string; nickname: string };
  likedAt: string;
  liked?: boolean;
};

export type LikedPhotosResponse = {
  items: LikedPhoto[];
  totalCount: number;
  nextCursor: string | null;
};

export type SavedPhotographer = {
  photographerId: string;
  nickname: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  categories: Category[];
  regions: Region[];
  savedAt: string;
};

export type SavedPhotographersResponse = {
  items: SavedPhotographer[];
  totalCount: number;
  nextCursor: string | null;
};
