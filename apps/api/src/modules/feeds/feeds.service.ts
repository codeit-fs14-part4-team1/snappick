import type { Prisma } from '../../generated/prisma/client.js';
import { Category, Region, Style } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { nextCursor, readCursorTime, readOffset } from '../../utils/cursor.js';
import { HttpError } from '../../utils/http-error.js';
import {
  finalScores,
  spreadPhotographers,
} from '../recommendations/feed-score.js';
import type { PhotosQuery } from './feeds.schema.js';
import {
  getListedPhotographerIds,
  isListedPhotographer,
} from './listed-photographers.js';

/**
 * 조회하는 계정. 비회원이면 둘 다 null
 * liked·saved는 일반 사용자(userId)일 때만 계산하고, 그 밖에는 false
 */
export type Viewer = {
  userId: string | null;
  photographerId: string | null;
};

const roundRating = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10;

async function likedPhotoIds(
  viewer: Viewer,
  photoIds: string[],
): Promise<Set<string>> {
  if (!viewer.userId || photoIds.length === 0) {
    return new Set();
  }
  const likes = await prisma.photo_likes.findMany({
    where: { user_id: viewer.userId, photo_id: { in: photoIds } },
    select: { photo_id: true },
  });
  return new Set(likes.map(({ photo_id }) => photo_id));
}

// ---------------------------------------------------------------------------
// GET /photos/{photoId}

export async function getPhotoDetail(photoId: string, viewer: Viewer) {
  const photo = await prisma.photos.findUnique({
    where: { id: photoId },
    include: {
      photographer: {
        select: {
          id: true,
          auth_account: { select: { nickname: true } },
          profile_image_url: true,
        },
      },
      photoKeyword: { select: { keyword: true }, orderBy: { id: 'asc' } },
      _count: { select: { photoLike: true } },
    },
  });
  if (!photo) {
    throw new HttpError(404, 'PHOTO_NOT_FOUND', '사진을 찾을 수 없어요.');
  }

  const { photographer } = photo;
  const [reviews, liked, save] = await Promise.all([
    prisma.reviews.aggregate({
      where: { photographer_id: photographer.id, deleted_at: null },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    likedPhotoIds(viewer, [photo.id]),
    viewer.userId
      ? prisma.photographer_saves.findUnique({
          where: {
            photographer_id_user_id: {
              photographer_id: photographer.id,
              user_id: viewer.userId,
            },
          },
          select: { user_id: true },
        })
      : null,
  ]);

  return {
    photoId: photo.id,
    imageUrl: toImageUrl(photo.storage_location),
    width: photo.width,
    height: photo.height,
    categories: photo.categories,
    styles: photo.styles,
    keywords: photo.photoKeyword.map(({ keyword }) => keyword),
    description: photo.description,
    likeCount: photo._count.photoLike,
    liked: liked.has(photo.id),
    createdAt: photo.created_at.toISOString(),
    photographer: {
      id: photographer.id,
      nickname: photographer.auth_account.nickname,
      profileImageUrl: toImageUrl(photographer.profile_image_url),
      ratingAvg: roundRating(reviews._avg.rating),
      reviewCount: reviews._count._all,
      saved: save !== null,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /photographers/{photographerId}/photos

export async function getPhotographerPhotos(
  photographerId: string,
  query: {
    excludePhotoId?: string | undefined;
    cursor?: string | undefined;
    limit: number;
  },
  viewer: Viewer,
) {
  const photographer = await prisma.photographers.findUnique({
    where: { id: photographerId },
    select: { id: true, representativePhoto: { select: { photo_id: true } } },
  });
  if (!photographer) {
    throw new HttpError(
      404,
      'PHOTOGRAPHER_NOT_FOUND',
      '작가를 찾을 수 없어요.',
    );
  }
  // 노출 기준 미달 작가는 본인만 볼 수 있다 (PF-11)
  const isSelf = viewer.photographerId === photographerId;
  if (!isSelf && !(await isListedPhotographer(photographerId))) {
    throw new HttpError(403, 'PHOTOGRAPHER_NOT_READY', '준비 중인 작가예요.');
  }

  const key = `pg:${photographerId}:${query.excludePhotoId ?? ''}`;
  const offset = readOffset(query.cursor, key);
  const where: Prisma.photosWhereInput = {
    photographer_id: photographerId,
    ...(query.excludePhotoId && { id: { not: query.excludePhotoId } }),
  };

  const [totalCount, rows] = await Promise.all([
    prisma.photos.count({ where }),
    prisma.photos.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: query.limit + 1,
      select: {
        id: true,
        storage_location: true,
        width: true,
        height: true,
        _count: { select: { photoLike: true } },
      },
    }),
  ]);
  const page = rows.slice(0, query.limit);
  const liked = await likedPhotoIds(
    viewer,
    page.map(({ id }) => id),
  );
  const representativeId = photographer.representativePhoto?.photo_id;

  return {
    items: page.map((photo) => ({
      photoId: photo.id,
      imageUrl: toImageUrl(photo.storage_location),
      width: photo.width,
      height: photo.height,
      likeCount: photo._count.photoLike,
      liked: liked.has(photo.id),
      isRepresentative: photo.id === representativeId,
    })),
    totalCount,
    nextCursor:
      rows.length > query.limit ? nextCursor(offset + query.limit, key) : null,
  };
}

// ---------------------------------------------------------------------------
// GET /photos

const CATEGORY_VALUES = new Set<string>(Object.values(Category));
const STYLE_VALUES = new Set<string>(Object.values(Style));
const REGION_VALUES = new Set<string>(Object.values(Region));

function assertValues(
  values: string[],
  allowed: Set<string>,
  code: string,
  message: string,
): void {
  if (values.some((value) => !allowed.has(value))) {
    throw new HttpError(400, code, message);
  }
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];

/**
 * 추천순 점수 (사진 id → 최종 점수)
 * 순위 비율이 필터마다 달라지지 않게 필터와 상관없이 전체 사진으로 계산한다
 * baseTime 이후에 올라온 사진은 빼서, 스크롤 도중 새 사진 때문에 다른 사진의 비율이 바뀌지 않게 한다
 * 가치 점수 행이 없는 사진(등록 때 행을 못 만든 경우)은 같은 작가의 다른 사진 값으로 채운다
 * (작가 점수·새 작가 여부는 같은 작가 사진끼리 같은 값)
 */
async function recommendedScores(baseTime: Date): Promise<Map<string, number>> {
  const photos = await prisma.photos.findMany({
    where: { created_at: { lte: baseTime } },
    select: {
      id: true,
      photographer_id: true,
      valueScore: {
        select: {
          photo_score: true,
          photographer_score: true,
          is_new_photographer: true,
        },
      },
    },
  });
  const byPhotographer = new Map(
    photos.flatMap(({ photographer_id, valueScore }) =>
      valueScore ? [[photographer_id, valueScore]] : [],
    ),
  );
  return finalScores(
    photos.map((photo) => {
      const score =
        photo.valueScore ?? byPhotographer.get(photo.photographer_id);
      return {
        photoId: photo.id,
        photoScore: photo.valueScore?.photo_score ?? 0,
        photographerScore: score?.photographer_score ?? 0,
        isNewPhotographer: score?.is_new_photographer ?? false,
      };
    }),
  );
}

export async function getPhotos(query: PhotosQuery, viewer: Viewer) {
  if (query.category !== undefined) {
    assertValues(
      [query.category],
      CATEGORY_VALUES,
      'INVALID_CATEGORY',
      '선택할 수 없는 카테고리예요.',
    );
  }
  assertValues(
    query.styles,
    STYLE_VALUES,
    'INVALID_STYLE',
    '선택할 수 없는 스타일이에요.',
  );
  assertValues(
    query.regions,
    REGION_VALUES,
    'INVALID_REGION',
    '선택할 수 없는 지역이에요.',
  );

  const category = query.category as Category | undefined;
  const styles = unique(query.styles) as Style[];
  const regions = unique(query.regions) as Region[];
  const keyword = query.keyword || undefined;
  const isRecommended = query.sort === 'recommended';
  // 추천순은 사용자 유형마다 목록이 달라진다 (1단계부터). 스크롤 도중 로그인·로그아웃하면 INVALID_CURSOR
  const viewerType = viewer.userId
    ? 'user'
    : viewer.photographerId
      ? 'photographer'
      : 'guest';

  const key = JSON.stringify([
    query.sort,
    isRecommended ? viewerType : null,
    category ?? null,
    [...styles].sort(),
    [...regions].sort(),
    keyword ?? null,
  ]);
  const offset = readOffset(query.cursor, key);
  // 추천순은 첫 페이지 시각(기준 시각)을 커서에 담아 순서를 고정한다
  // 그 뒤에 올라온 사진은 이번 목록에서 빼서, 앞에 끼어들어 사진이 중복되지 않게 한다
  const baseTime = isRecommended
    ? (readCursorTime(query.cursor) ?? new Date())
    : null;

  const where: Prisma.photosWhereInput = {
    photographer_id: { in: await getListedPhotographerIds() },
    ...(baseTime && { created_at: { lte: baseTime } }),
    ...(category && { categories: { has: category } }),
    ...(styles.length > 0 && { styles: { hasSome: styles } }),
    ...(regions.length > 0 && {
      photographer: { regions: { hasSome: regions } },
    }),
    ...(keyword && {
      OR: [
        { description: { contains: keyword, mode: 'insensitive' } },
        {
          photographer: {
            auth_account: {
              nickname: { contains: keyword, mode: 'insensitive' },
            },
          },
        },
        { photoKeyword: { some: { keyword: { contains: keyword } } } },
      ],
    }),
  };

  // 정렬 후보를 가볍게 가져와 서버에서 정렬한다
  // 사진 수가 수천 장을 넘으면 정렬을 SQL로 옮기기
  const candidates = await prisma.photos.findMany({
    where,
    select: {
      id: true,
      photographer_id: true,
      created_at: true,
      _count: { select: { photoLike: true } },
    },
  });
  const byLatest = (
    a: (typeof candidates)[number],
    b: (typeof candidates)[number],
  ) =>
    b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id);
  if (query.sort === 'latest') {
    candidates.sort(byLatest);
  } else if (query.sort === 'popular') {
    candidates.sort(
      (a, b) => b._count.photoLike - a._count.photoLike || byLatest(a, b),
    );
  } else if (baseTime) {
    const scores = await recommendedScores(baseTime);
    const scoreOf = (id: string) => scores.get(id) ?? 0;
    candidates.sort((a, b) => scoreOf(b.id) - scoreOf(a.id) || byLatest(a, b));
  }
  // 추천순은 정렬한 전체 목록에서 같은 작가가 연달아 나오지 않게 한 번 더 조정한다
  const ordered = isRecommended
    ? spreadPhotographers(
        candidates.map((photo) => ({
          id: photo.id,
          photographerId: photo.photographer_id,
        })),
      )
    : candidates;

  const pageIds = ordered
    .slice(offset, offset + query.limit)
    .map(({ id }) => id);
  const [rows, liked] = await Promise.all([
    prisma.photos.findMany({
      where: { id: { in: pageIds } },
      select: {
        id: true,
        storage_location: true,
        width: true,
        height: true,
        photographer: {
          select: {
            id: true,
            auth_account: { select: { nickname: true } },
            profile_image_url: true,
          },
        },
        _count: { select: { photoLike: true } },
      },
    }),
    likedPhotoIds(viewer, pageIds),
  ]);
  const rowById = new Map(rows.map((row) => [row.id, row]));

  return {
    items: pageIds.flatMap((id) => {
      const photo = rowById.get(id);
      return photo
        ? [
            {
              photoId: photo.id,
              imageUrl: toImageUrl(photo.storage_location),
              width: photo.width,
              height: photo.height,
              photographer: {
                id: photo.photographer.id,
                nickname: photo.photographer.auth_account.nickname,
                profileImageUrl: toImageUrl(
                  photo.photographer.profile_image_url,
                ),
              },
              likeCount: photo._count.photoLike,
              liked: liked.has(photo.id),
            },
          ]
        : [];
    }),
    totalCount: candidates.length,
    nextCursor:
      offset + query.limit < candidates.length
        ? nextCursor(offset + query.limit, key, baseTime)
        : null,
  };
}
