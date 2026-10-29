import { prisma } from '../../lib/prisma.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { nextCursor, readOffset } from '../../utils/cursor.js';

type PageQuery = { cursor?: string | undefined; limit: number };

/**
 * MY 픽 > 좋아요한 사진 (GET /me/liked-photos)
 * 좋아요한 시각 최신순. 작가가 준비 중이어도 사용자가 고른 사진이라 그대로 보여 준다
 */
export async function getLikedPhotos(userId: string, query: PageQuery) {
  const key = 'liked-photos';
  const offset = readOffset(query.cursor, key);
  const where = { user_id: userId };

  const [totalCount, rows] = await Promise.all([
    prisma.photo_likes.count({ where }),
    prisma.photo_likes.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { photo_id: 'desc' }],
      skip: offset,
      take: query.limit + 1,
      select: {
        created_at: true,
        photo: {
          select: {
            id: true,
            storage_location: true,
            width: true,
            height: true,
            photographer: { select: { id: true, nickname: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: rows.slice(0, query.limit).map(({ created_at, photo }) => ({
      photoId: photo.id,
      imageUrl: toImageUrl(photo.storage_location),
      width: photo.width,
      height: photo.height,
      photographer: {
        id: photo.photographer.id,
        nickname: photo.photographer.nickname,
      },
      likedAt: created_at.toISOString(),
    })),
    totalCount,
    nextCursor:
      rows.length > query.limit ? nextCursor(offset + query.limit, key) : null,
  };
}

/**
 * MY 픽 > 저장한 작가 (GET /me/saved-photographers)
 * 저장한 시각 최신순. 카드 커버는 대표 사진(PF-12), 없으면 null
 */
export async function getSavedPhotographers(userId: string, query: PageQuery) {
  const key = 'saved-photographers';
  const offset = readOffset(query.cursor, key);
  const where = { user_id: userId };

  const [totalCount, rows] = await Promise.all([
    prisma.photographer_saves.count({ where }),
    prisma.photographer_saves.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { photographer_id: 'desc' }],
      skip: offset,
      take: query.limit + 1,
      select: {
        created_at: true,
        photographer: {
          select: {
            id: true,
            nickname: true,
            profile_image_url: true,
            categories: true,
            regions: true,
            representativePhoto: {
              select: { photo: { select: { storage_location: true } } },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: rows.slice(0, query.limit).map(({ created_at, photographer }) => ({
      photographerId: photographer.id,
      nickname: photographer.nickname,
      profileImageUrl: toImageUrl(photographer.profile_image_url),
      coverImageUrl: toImageUrl(
        photographer.representativePhoto?.photo.storage_location ?? null,
      ),
      categories: photographer.categories,
      regions: photographer.regions,
      savedAt: created_at.toISOString(),
    })),
    totalCount,
    nextCursor:
      rows.length > query.limit ? nextCursor(offset + query.limit, key) : null,
  };
}
