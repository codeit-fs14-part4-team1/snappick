import { prisma } from '../../lib/prisma.js';
import {
  ACTION_WEIGHTS,
  DECAY_HALF_LIFE_MS,
  DECAY_RATING_ADJUSTMENT,
  NEW_PHOTOGRAPHER_PERIOD_MS,
  RATING_ADJUSTMENT,
} from './value-score.config.js';

type Rating = { average: number; count: number };

/**
 * 작가 평균 평점에 맞는 보정 배수 (리뷰가 적거나 없으면 1)
 */
export function ratingMultiplier(rating: Rating | undefined): number {
  if (!rating || rating.count < RATING_ADJUSTMENT.minReviews) {
    return 1;
  }
  const range = RATING_ADJUSTMENT.ranges.find(
    ({ min }) => rating.average >= min,
  );
  return range?.multiplier ?? 1;
}

type DecayedRow = { id: string; score: number };
type RatingRow = { id: string } & Rating;

/**
 * 가치 점수 배치 (하루 1번, 추천 기획서 vol.2 6-4)
 * 모든 사진의 photo_value_scores를 다시 계산해 저장한다
 * - 원본 테이블을 쓴다: 좋아요·저장 취소, 예약 취소, 리뷰 삭제가 그대로 반영되기 때문 (행동 로그에는 없음)
 * - 시간 감쇠 때문에 새 반응이 없어도 값이 바뀌므로 바뀐 것만이 아니라 전체를 계산한다
 * - 점수는 감쇠만 적용한 원래 값으로 저장한다. log·순위 비율 환산과 프리셋 비율은 피드 요청 때 적용한다
 * now: 기준 시각. 배치 안의 모든 행이 같은 시각으로 계산되도록 한 번만 정해서 넘긴다
 */
export async function refreshValueScores(now: Date) {
  const halfLifeSeconds = DECAY_HALF_LIFE_MS / 1000;
  // 행동마다 반영 비율: 0.5 ^ (지난 시간 / 반감기). 미래 시각은 지난 시간을 0으로 본다
  const decay = (column: string) =>
    `power(0.5, GREATEST(EXTRACT(EPOCH FROM ($1::timestamptz - ${column})), 0) / $2)`;

  const [likes, saves, reservations, ratings, photos, photographers] =
    await Promise.all([
      prisma.$queryRawUnsafe<DecayedRow[]>(
        `SELECT photo_id::text AS id, SUM(${decay('created_at')})::float8 AS score
         FROM photo_likes GROUP BY photo_id`,
        now,
        halfLifeSeconds,
      ),
      prisma.$queryRawUnsafe<DecayedRow[]>(
        `SELECT photographer_id::text AS id, SUM(${decay('created_at')})::float8 AS score
         FROM photographer_saves GROUP BY photographer_id`,
        now,
        halfLifeSeconds,
      ),
      // 취소된 예약은 제외한다. 예약 시각(결제한 때)을 기준으로 감쇠한다
      prisma.$queryRawUnsafe<DecayedRow[]>(
        `SELECT photographer_id::text AS id, SUM(${decay('created_at')})::float8 AS score
         FROM reservations
         WHERE photographer_id IS NOT NULL AND status <> 'CANCELED'
         GROUP BY photographer_id`,
        now,
        halfLifeSeconds,
      ),
      // 삭제한 리뷰는 제외. 개수는 감쇠 없이 센다 (minReviews는 표본 수 기준)
      // 감쇠 버전: 최근 리뷰에 무게를 더 준 가중 평균 Σ(평점·감쇠) / Σ감쇠
      // 감쇠 없는 버전: 단순 평균
      DECAY_RATING_ADJUSTMENT
        ? prisma.$queryRawUnsafe<RatingRow[]>(
            `SELECT photographer_id::text AS id,
                    (SUM(rating * ${decay('created_at')}) / SUM(${decay('created_at')}))::float8 AS average,
                    COUNT(*)::int AS count
             FROM reviews
             WHERE photographer_id IS NOT NULL AND deleted_at IS NULL
             GROUP BY photographer_id`,
            now,
            halfLifeSeconds,
          )
        : prisma.$queryRawUnsafe<RatingRow[]>(
            `SELECT photographer_id::text AS id,
                    AVG(rating)::float8 AS average,
                    COUNT(*)::int AS count
             FROM reviews
             WHERE photographer_id IS NOT NULL AND deleted_at IS NULL
             GROUP BY photographer_id`,
          ),
      prisma.photos.findMany({ select: { id: true, photographer_id: true } }),
      prisma.photographers.findMany({ select: { id: true, created_at: true } }),
    ]);

  const toMap = (rows: DecayedRow[]) =>
    new Map(rows.map(({ id, score }) => [id, score]));
  const likeScores = toMap(likes);
  const saveScores = toMap(saves);
  const reserveScores = toMap(reservations);
  const ratingByPhotographer = new Map(
    ratings.map(({ id, average, count }) => [id, { average, count }]),
  );

  // 작가 점수와 새 작가 여부는 작가마다 한 번 계산해 그 작가의 사진에 똑같이 넣는다
  const byPhotographer = new Map(
    photographers.map(({ id, created_at }) => {
      const actions =
        ACTION_WEIGHTS.save * (saveScores.get(id) ?? 0) +
        ACTION_WEIGHTS.reserve * (reserveScores.get(id) ?? 0);
      return [
        id,
        {
          score: actions * ratingMultiplier(ratingByPhotographer.get(id)),
          isNew:
            now.getTime() - created_at.getTime() < NEW_PHOTOGRAPHER_PERIOD_MS,
        },
      ];
    }),
  );

  const rows = photos.map(({ id, photographer_id }) => {
    const photographer = byPhotographer.get(photographer_id);
    return {
      photo_id: id,
      photo_score: ACTION_WEIGHTS.like * (likeScores.get(id) ?? 0),
      photographer_score: photographer?.score ?? 0,
      is_new_photographer: photographer?.isNew ?? false,
    };
  });

  // 사진이 많아져도 쿼리 한 번으로 저장한다 (삭제된 사진의 행은 FK cascade로 지워진다)
  if (rows.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO photo_value_scores
        (photo_id, photo_score, photographer_score, is_new_photographer, updated_at)
      SELECT *, ${now}::timestamptz
      FROM unnest(
        ${rows.map((row) => row.photo_id)}::uuid[],
        ${rows.map((row) => row.photo_score)}::float8[],
        ${rows.map((row) => row.photographer_score)}::float8[],
        ${rows.map((row) => row.is_new_photographer)}::boolean[]
      )
      ON CONFLICT (photo_id) DO UPDATE SET
        photo_score = EXCLUDED.photo_score,
        photographer_score = EXCLUDED.photographer_score,
        is_new_photographer = EXCLUDED.is_new_photographer,
        updated_at = EXCLUDED.updated_at
    `;
  }

  return {
    photos: rows.length,
    newPhotographers: [...byPhotographer.values()].filter(({ isNew }) => isNew)
      .length,
  };
}
