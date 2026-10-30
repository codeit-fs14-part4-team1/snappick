import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { HttpError } from '../../utils/http-error.js';
import type { AccessTokenPayload } from '../../utils/tokens.js';
import type { UpdateProfileInput } from './photographers.schema.js';

const roundRating = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10;

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const PROFILE_SELECT = {
  id: true,
  auth_account_id: true,
  nickname: true,
  profile_image_url: true,
  career: true,
  regions: true,
  categories: true,
  introduction: true,
} satisfies Prisma.photographersSelect;

type ProfileRow = Prisma.photographersGetPayload<{
  select: typeof PROFILE_SELECT;
}>;

// 명세의 checks에 categories를 더한 것
const READINESS_KEYS = [
  'profileImage',
  'career',
  'regions',
  'categories',
  'introduction',
  'representativePhoto',
  'product',
] as const;

type ReadinessKey = (typeof READINESS_KEYS)[number];

export type Readiness = {
  isReady: boolean;
  checks: Record<ReadinessKey, boolean>;
  missing: ReadinessKey[];
};

const hasText = (value: string | null): boolean =>
  value !== null && value.trim() !== '';

// 프로필 완료 여부: 공개 프로필의 isReady와 /me/readiness가 같은 판정을 쓴다
async function getReadiness(photographer: ProfileRow): Promise<Readiness> {
  const [representative, product] = await Promise.all([
    prisma.representative_photos.findUnique({
      where: { photographer_id: photographer.id },
      select: { photo_id: true },
    }),
    prisma.products.findFirst({
      where: { photographer_id: photographer.id },
      select: { id: true },
    }),
  ]);

  const checks: Record<ReadinessKey, boolean> = {
    profileImage: hasText(photographer.profile_image_url),
    career: photographer.career !== null,
    regions: photographer.regions.length > 0,
    categories: photographer.categories.length > 0,
    introduction: hasText(photographer.introduction),
    representativePhoto: representative !== null,
    product: product !== null,
  };
  // false인 항목만 모은다
  const missing = READINESS_KEYS.filter((key) => !checks[key]);

  return { isReady: missing.length === 0, checks, missing };
}

async function findViewerUserId(
  auth: AccessTokenPayload | undefined,
): Promise<string | null> {
  if (auth?.accountType !== 'USER') {
    return null;
  }
  const user = await prisma.users.findUnique({
    where: { auth_account_id: auth.accountId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function buildProfile(
  photographer: ProfileRow,
  viewer: { isSelf: boolean; userId: string | null },
) {
  const [reviews, save, readiness] = await Promise.all([
    prisma.reviews.aggregate({
      where: { photographer_id: photographer.id, deleted_at: null },
      _avg: { rating: true },
      _count: { _all: true },
    }),
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
    getReadiness(photographer),
  ]);

  return {
    id: photographer.id,
    nickname: photographer.nickname,
    profileImageUrl: toImageUrl(photographer.profile_image_url),
    career: photographer.career,
    regions: photographer.regions,
    categories: photographer.categories,
    introduction: photographer.introduction,
    ratingAvg: roundRating(reviews._avg.rating),
    reviewCount: reviews._count._all,
    saved: save !== null,
    isSelf: viewer.isSelf,
    isReady: readiness.isReady,
  };
}

export async function getPhotographerProfile(
  photographerId: string,
  auth: AccessTokenPayload | undefined,
) {
  const photographer = await prisma.photographers.findUnique({
    where: { id: photographerId },
    select: PROFILE_SELECT,
  });
  if (!photographer) {
    throw new HttpError(
      404,
      'PHOTOGRAPHER_NOT_FOUND',
      '작가를 찾을 수 없어요.',
    );
  }

  const isSelf = auth?.accountId === photographer.auth_account_id;
  const userId = await findViewerUserId(auth);
  return buildProfile(photographer, { isSelf, userId });
}

async function findMine(auth: AccessTokenPayload): Promise<ProfileRow> {
  const photographer = await prisma.photographers.findUnique({
    where: { auth_account_id: auth.accountId },
    select: PROFILE_SELECT,
  });
  if (!photographer) {
    throw auth.accountType === 'USER'
      ? new HttpError(
          403,
          'ACCOUNT_TYPE_NOT_ALLOWED',
          '작가 계정만 사용할 수 있어요.',
        )
      : new HttpError(404, 'PROFILE_NOT_FOUND', '프로필을 찾을 수 없어요.');
  }
  return photographer;
}

export async function getMyProfile(auth: AccessTokenPayload) {
  const photographer = await findMine(auth);
  return buildProfile(photographer, { isSelf: true, userId: null });
}

export async function getMyReadiness(auth: AccessTokenPayload) {
  const photographer = await findMine(auth);
  return getReadiness(photographer);
}

export async function updateMyProfile(
  auth: AccessTokenPayload,
  input: UpdateProfileInput,
) {
  const mine = await findMine(auth);

  await prisma.photographers.update({
    where: { id: mine.id },
    data: {
      ...(input.nickname !== undefined && { nickname: input.nickname }),
      ...(input.career !== undefined && { career: input.career }),
      ...(input.regions !== undefined && { regions: unique(input.regions) }),
      ...(input.categories !== undefined && {
        categories: unique(input.categories),
      }),
      ...(input.introduction !== undefined && {
        introduction: input.introduction,
      }),
    },
  });

  return getMyProfile(auth);
}
