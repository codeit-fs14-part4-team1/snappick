import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import {
  isReviewSummaryEnabled,
  PROMPT_VERSION,
  requestReviewSummary,
  sourceKeyOf,
  type Caution,
  type Highlight,
  type PreviousSummary,
  type SummaryReview,
} from './review-summary-ai.js';

const MAX_REVIEWS = 50;
const MIN_REVIEWS = 3;
// 호출 60초 + SDK 재시도 2회까지 끝날 시간. 서버가 중간에 꺼져도 이 시간 뒤 다시 만든다
const LOCK_MS = 5 * 60_000;
// 호출 오류(네트워크, 한도 초과 등) 뒤 다시 시도하기까지 기다리는 시간
const ERROR_RETRY_MS = 10 * 60_000;
// 새 리뷰만 늘었을 때는 리뷰가 50개 쌓였거나,
// 마지막 요약 뒤 2주가 지났고 그동안 새 리뷰가 10개를 넘을 때만 다시 만든다
const NEW_REVIEW_THRESHOLD = 50;
const STALE_MS = 14 * 24 * 60 * 60_000; // 2주
const STALE_MIN_NEW_REVIEWS = 10;

export type ReviewSummaryStatus =
  'READY' | 'UPDATING' | 'NOT_ENOUGH' | 'UNAVAILABLE';

type SummaryRow = NonNullable<
  Awaited<ReturnType<typeof prisma.review_summaries.findUnique>>
>;

// 요약 입력: 삭제되지 않은 최근 리뷰 50개
function findRecentReviews(photographerId: string): Promise<SummaryReview[]> {
  return prisma.reviews.findMany({
    where: { photographer_id: photographerId, deleted_at: null },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: MAX_REVIEWS,
    select: { id: true, rating: true, comment: true, updated_at: true },
  });
}

// 같은 입력으로 거절·검증 실패했거나, 호출 오류 뒤 얼마 지나지 않았으면 다시 부르지 않는다
function isRetryBlocked(row: SummaryRow | null, sourceKey: string): boolean {
  if (!row?.last_attempt_result || !row.last_attempt_at) {
    return false;
  }
  if (row.last_attempt_result === 'ERROR') {
    return Date.now() - row.last_attempt_at.getTime() < ERROR_RETRY_MS;
  }
  return (
    row.last_attempt_key === sourceKey &&
    (row.last_attempt_result === 'REFUSED' ||
      row.last_attempt_result === 'INVALID')
  );
}

// 저장된 요약에 쓴 리뷰가 모두 남아 있고 그 뒤 수정되지 않았는지 (새 리뷰만 늘어난 경우)
async function isOnlyAdded(row: SummaryRow): Promise<boolean> {
  if (!row.generated_at || row.source_review_ids.length === 0) {
    return false;
  }
  const generatedAt = row.generated_at;
  const sources = await prisma.reviews.findMany({
    where: { id: { in: row.source_review_ids }, deleted_at: null },
    select: { updated_at: true },
  });
  return (
    sources.length === row.source_review_ids.length &&
    sources.every((review) => review.updated_at <= generatedAt)
  );
}

// 새 리뷰만 늘어난 요약을 지금 다시 만들지. 리뷰가 하나 늘 때마다 부르지 않는다
function isWorthRefreshing(row: SummaryRow, reviews: SummaryReview[]) {
  const summarized = new Set(row.source_review_ids);
  const newCount = reviews.filter(
    (review) => !summarized.has(review.id),
  ).length;
  if (newCount >= NEW_REVIEW_THRESHOLD) {
    return true;
  }
  return (
    newCount > STALE_MIN_NEW_REVIEWS &&
    row.generated_at !== null &&
    Date.now() - row.generated_at.getTime() >= STALE_MS
  );
}

function toPreviousSummary(row: SummaryRow): PreviousSummary | null {
  if (!row.summary) {
    return null;
  }
  const highlights = row.highlights as Highlight[];
  const caution = row.caution as Caution | null;
  return {
    summary: row.summary,
    highlights: highlights.map((highlight) => highlight.label),
    caution: caution?.text ?? null,
    reviewCount: row.source_review_ids.length,
  };
}

function toResponse(
  photographerId: string,
  status: ReviewSummaryStatus,
  row: SummaryRow | null,
) {
  if (!row?.summary || !row.generated_at) {
    return {
      photographerId,
      status,
      summary: null,
      highlights: [],
      caution: null,
      sourceReviewCount: 0,
      generatedAt: null,
    };
  }
  const highlights = row.highlights as Highlight[];
  const caution = row.caution as Caution | null;
  return {
    photographerId,
    status,
    summary: row.summary,
    highlights: highlights.map((highlight) => ({
      label: highlight.label,
      count: highlight.reviewIds.length,
    })),
    caution: caution && {
      text: caution.text,
      count: caution.reviewIds.length,
    },
    sourceReviewCount: row.source_review_ids.length,
    generatedAt: row.generated_at,
  };
}

const hasHighlights = (row: SummaryRow | null) =>
  Boolean(row?.summary) &&
  Array.isArray(row?.highlights) &&
  row.highlights.length > 0;

/**
 * 리뷰 요약 조회 (GET /photographers/:photographerId/reviews/summary)
 * AI 호출을 기다리지 않는다. 다시 만들어야 하면 shouldGenerate로 알려 주고,
 * 컨트롤러가 응답을 보낸 뒤 generateReviewSummary를 시작한다
 */
export async function getReviewSummary(photographerId: string) {
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

  const reviews = await findRecentReviews(photographerId);
  if (reviews.length < MIN_REVIEWS) {
    return {
      body: toResponse(photographerId, 'NOT_ENOUGH', null),
      shouldGenerate: false,
    };
  }

  const sourceKey = sourceKeyOf(reviews);
  const row = await prisma.review_summaries.findUnique({
    where: { photographer_id: photographerId },
  });

  // 지금 리뷰로 만든 요약이 있다. 장점이 하나도 안 남았으면 보여 주지 않는다
  if (row?.source_key === sourceKey) {
    return {
      body: hasHighlights(row)
        ? toResponse(photographerId, 'READY', row)
        : toResponse(photographerId, 'UNAVAILABLE', null),
      shouldGenerate: false,
    };
  }

  if (!isReviewSummaryEnabled()) {
    return {
      body: toResponse(photographerId, 'UNAVAILABLE', null),
      shouldGenerate: false,
    };
  }

  // 새 리뷰만 늘었으면 새 요약이 나올 때까지 이전 요약을 보여 준다
  // 요약에 쓴 리뷰가 수정·삭제됐으면 지워진 내용이 남아 있을 수 있어 숨긴다
  const onlyAdded = row?.summary ? await isOnlyAdded(row) : false;
  const previous = row && onlyAdded && hasHighlights(row) ? row : null;

  // 새 리뷰가 조금 늘었을 뿐이면 이전 요약을 그대로 쓴다
  if (row && onlyAdded && !isWorthRefreshing(row, reviews)) {
    return {
      body: previous
        ? toResponse(photographerId, 'READY', previous)
        : toResponse(photographerId, 'UNAVAILABLE', null),
      shouldGenerate: false,
    };
  }

  if (isRetryBlocked(row, sourceKey)) {
    return {
      body: previous
        ? toResponse(photographerId, 'READY', previous)
        : toResponse(photographerId, 'UNAVAILABLE', null),
      shouldGenerate: false,
    };
  }

  return {
    body: toResponse(photographerId, 'UPDATING', previous),
    shouldGenerate: true,
  };
}

/**
 * 요약 생성 (응답 뒤에 실행)
 * 작가별 잠금(locked_until)으로 서버가 여러 대여도 동시에 한 번만 만든다
 * 실패해도 이전 요약은 지우지 않고 시도 결과만 기록한다
 */
export async function generateReviewSummary(photographerId: string) {
  await prisma.review_summaries.upsert({
    where: { photographer_id: photographerId },
    create: { photographer_id: photographerId },
    update: {},
  });
  const now = new Date();
  const { count } = await prisma.review_summaries.updateMany({
    where: {
      photographer_id: photographerId,
      OR: [{ locked_until: null }, { locked_until: { lt: now } }],
    },
    data: { locked_until: new Date(now.getTime() + LOCK_MS) },
  });
  if (count === 0) {
    return; // 다른 요청이 만드는 중
  }

  let attempt: {
    key: string;
    result: 'OK' | 'REFUSED' | 'INVALID' | 'ERROR';
  } | null = null;
  try {
    // 잠금을 얻는 사이 다른 요청이 이미 만들었을 수 있어 다시 확인한다
    const readAt = new Date();
    const reviews = await findRecentReviews(photographerId);
    if (reviews.length < MIN_REVIEWS) {
      return;
    }
    const sourceKey = sourceKeyOf(reviews);
    const row = await prisma.review_summaries.findUnique({
      where: { photographer_id: photographerId },
    });
    if (row?.source_key === sourceKey || isRetryBlocked(row, sourceKey)) {
      return;
    }

    // 새 리뷰만 늘었으면 이전 요약과 최근 리뷰를 함께 보낸다
    // 요약에 쓴 리뷰가 수정·삭제됐으면 이전 요약에 지워진 내용이 있을 수 있어 최근 리뷰만으로 새로 만든다
    const onlyAdded = row?.summary ? await isOnlyAdded(row) : false;
    if (row && onlyAdded && !isWorthRefreshing(row, reviews)) {
      return;
    }
    const previous = row && onlyAdded ? toPreviousSummary(row) : null;
    const sourceReviewIds = [
      ...new Set([
        ...(previous && row ? row.source_review_ids : []),
        ...reviews.map((review) => review.id),
      ]),
    ];

    const { result, usage } = await requestReviewSummary(reviews, previous);
    attempt = { key: sourceKey, result: result.result };
    console.info(
      JSON.stringify({
        feature: 'review-summary',
        photographerId,
        promptVersion: PROMPT_VERSION,
        mode: previous ? 'incremental' : 'full',
        result: result.result,
        ...(result.result !== 'OK' && { reason: result.reason }),
        ...usage,
      }),
    );

    if (result.result === 'OK') {
      await prisma.review_summaries.update({
        where: { photographer_id: photographerId },
        data: {
          summary: result.summary,
          highlights: result.highlights,
          caution: result.caution ?? Prisma.DbNull,
          // 이전 요약을 이어 썼으면 그 요약에 쓴 리뷰까지 포함한다. 그중 하나라도 수정·삭제되면 처음부터 다시 만든다
          source_review_ids: sourceReviewIds,
          source_key: sourceKey,
          model: usage?.model ?? null,
          prompt_version: PROMPT_VERSION,
          // 입력을 읽은 시각. 이후 수정된 리뷰는 요약에 반영되지 않은 것으로 본다
          generated_at: readAt,
        },
      });
    }
  } catch (error) {
    attempt = attempt ?? { key: '', result: 'ERROR' };
    throw error;
  } finally {
    await prisma.review_summaries.update({
      where: { photographer_id: photographerId },
      data: {
        locked_until: null,
        ...(attempt && {
          last_attempt_key: attempt.key,
          last_attempt_result: attempt.result,
          last_attempt_at: new Date(),
        }),
      },
    });
  }
}
