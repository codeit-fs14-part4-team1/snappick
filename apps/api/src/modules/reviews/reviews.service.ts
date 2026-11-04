import { prisma } from '../../lib/prisma.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { HttpError } from '../../utils/http-error.js';
import type { ReviewsQuery } from './reviews.schema.js';

const replySelect = {
  id: true,
  comment: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const;

type ReplyRow = {
  id: string;
  comment: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

function toReply(reply: ReplyRow | null) {
  if (!reply || reply.deleted_at) {
    return null;
  }
  return {
    replyId: reply.id,
    comment: reply.comment,
    createdAt: reply.created_at,
    updatedAt: reply.updated_at,
  };
}

// GET /photographers/:photographerId/reviews
export async function getPhotographerReviews(
  photographerId: string,
  query: ReviewsQuery,
) {
  const photographer = await prisma.photographers.findUnique({
    where: { id: photographerId },
    select: { id: true },
  });
  if (!photographer) {
    throw new HttpError(
      404,
      'PHOTOGRAPHER_NOT_FOUND',
      '작가를 찾을 수 없어요.',
    );
  }

  const where = { photographer_id: photographerId, deleted_at: null };

  const [totalCount, rows] = await Promise.all([
    prisma.reviews.count({ where }),
    prisma.reviews.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        rating: true,
        comment: true,
        created_at: true,
        updated_at: true,
        user: { select: { nickname: true, profile_image_url: true } },
        reviewReply: { select: replySelect },
      },
    }),
  ]);

  return {
    items: rows.map((review) => ({
      reviewId: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      author: review.user && {
        nickname: review.user.nickname,
        profileImageUrl: toImageUrl(review.user.profile_image_url),
      },
      reply: toReply(review.reviewReply),
    })),
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / query.pageSize),
  };
}

// GET /me/reviews
export async function getMyReviews(userId: string, query: ReviewsQuery) {
  const where = { user_id: userId, deleted_at: null };

  const [totalCount, rows] = await Promise.all([
    prisma.reviews.count({ where }),
    prisma.reviews.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        reservation_id: true,
        rating: true,
        comment: true,
        created_at: true,
        updated_at: true,
        photographer: {
          select: { id: true, nickname: true, profile_image_url: true },
        },
        reviewReply: { select: replySelect },
      },
    }),
  ]);

  return {
    items: rows.map((review) => ({
      reviewId: review.id,
      reservationId: review.reservation_id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      photographer: review.photographer && {
        photographerId: review.photographer.id,
        nickname: review.photographer.nickname,
        profileImageUrl: toImageUrl(review.photographer.profile_image_url),
      },
      reply: toReply(review.reviewReply),
    })),
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / query.pageSize),
  };
}
