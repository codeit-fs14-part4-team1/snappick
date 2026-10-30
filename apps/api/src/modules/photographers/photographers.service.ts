import { prisma } from '../../lib/prisma.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { HttpError } from '../../utils/http-error.js';
import type { AccessTokenPayload } from '../../utils/tokens.js';

const roundRating = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10;

/**
 * 프로필 완료 여부: 프로필 이미지·상세 소개·활동 지역·촬영 카테고리가 모두 있어야 한다
 * 활동명(nickname)은 필수 컬럼이라 따로 확인하지 않는다
 */
const isProfileReady = (photographer: {
  profile_image_url: string | null;
  introduction: string | null;
  regions: unknown[];
  categories: unknown[];
}): boolean =>
  photographer.profile_image_url !== null &&
  photographer.introduction !== null &&
  photographer.regions.length > 0 &&
  photographer.categories.length > 0;

// 저장 여부(saved)는 일반 사용자만 가진다. 작가 계정과 비회원은 null
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

export async function getPhotographerProfile(
  photographerId: string,
  auth: AccessTokenPayload | undefined,
) {
  const photographer = await prisma.photographers.findUnique({
    where: { id: photographerId },
    select: {
      id: true,
      auth_account_id: true,
      nickname: true,
      profile_image_url: true,
      career: true,
      regions: true,
      categories: true,
      introduction: true,
    },
  });
  if (!photographer) {
    throw new HttpError(
      404,
      'PHOTOGRAPHER_NOT_FOUND',
      '작가를 찾을 수 없어요.',
    );
  }

  // 로그인한 계정이 이 프로필의 주인인지 (UI가 본인용 화면으로 바뀐다)
  const isSelf = auth?.accountId === photographer.auth_account_id;

  const userId = await findViewerUserId(auth);
  const [reviews, save] = await Promise.all([
    prisma.reviews.aggregate({
      where: { photographer_id: photographerId, deleted_at: null },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    userId
      ? prisma.photographer_saves.findUnique({
          where: {
            photographer_id_user_id: {
              photographer_id: photographerId,
              user_id: userId,
            },
          },
          select: { user_id: true },
        })
      : null,
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
    isSelf,
    isReady: isProfileReady(photographer),
  };
}
