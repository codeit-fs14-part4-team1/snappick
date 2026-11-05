import { prisma } from '../../lib/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  ReviewsQuery,
  CreateReviewInput,
  UpdateReviewInput,
} from './reviews.schema.js';

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

// POST /me/reviews
export async function createReview(userId: string, input: CreateReviewInput) {
  const reservation = await prisma.reservations.findUnique({
    where: { id: input.reservationId },
    select: { user_id: true, photographer_id: true, status: true },
  });

  if (!reservation || reservation.user_id !== userId) {
    throw new HttpError(404, 'RESERVATION_NOT_FOUND', '예약을 찾을 수 없어요.');
  }

  if (reservation.status !== 'PURCHASE_CONFIRMED') {
    throw new HttpError(
      409,
      'RESERVATION_NOT_PURCHASE_CONFIRMED',
      '리뷰를 작성할 수 있는 상태가 아니에요.',
    );
  }

  if (!reservation.photographer_id) {
    throw new HttpError(
      409,
      'PHOTOGRAPHER_UNAVAILABLE',
      '탈퇴한 작가의 예약에는 리뷰를 작성할 수 없습니다.',
    );
  }

  try {
    const review = await prisma.reviews.create({
      data: {
        reservation_id: input.reservationId,
        user_id: userId,
        photographer_id: reservation.photographer_id,
        rating: input.rating,
        comment: input.comment,
      },
      select: {
        id: true,
        reservation_id: true,
        photographer_id: true,
        rating: true,
        comment: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      reviewId: review.id,
      reservationId: review.reservation_id,
      photographerId: review.photographer_id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new HttpError(
        409,
        'REVIEW_ALREADY_EXISTS',
        '이미 작성된 리뷰가 있어요.',
      );
    }
    throw error;
  }
}

// PATCH /me/reviews/{reviewId}
export async function updateMyReview(
  userId: string,
  reviewId: string,
  input: UpdateReviewInput,
) {
  const mine = await prisma.reviews.findFirst({
    where: { id: reviewId, user_id: userId, deleted_at: null },
    select: { id: true },
  });
  if (!mine) {
    throw new HttpError(404, 'REVIEW_NOT_FOUND', '리뷰를 찾을 수 없어요.');
  }

  const review = await prisma.reviews.update({
    where: { id: reviewId },
    data: {
      ...(input.rating !== undefined && { rating: input.rating }),
      ...(input.comment !== undefined && { comment: input.comment }),
    },
    select: {
      id: true,
      reservation_id: true,
      photographer_id: true,
      rating: true,
      comment: true,
      created_at: true,
      updated_at: true,
    },
  });

  return {
    reviewId: review.id,
    reservationId: review.reservation_id,
    photographerId: review.photographer_id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
  };
}

// DELETE /me/reviews/{reviewId}

export async function deleteMyReview(userId: string, reviewId: string) {
  const { count } = await prisma.reviews.updateMany({
    where: { id: reviewId, user_id: userId, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  if (count === 0) {
    throw new HttpError(404, 'REVIEW_NOT_FOUND', '리뷰를 찾을 수 없어요.');
  }
}
