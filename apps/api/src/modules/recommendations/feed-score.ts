import {
  DEFAULT_GOAL,
  FINAL_SCORE_WEIGHTS,
  GOAL_PRESETS,
  type Goal,
} from './feed-score.config.js';

export type ValueScore = {
  photoId: string;
  photoScore: number;
  photographerScore: number;
  isNewPhotographer: boolean;
};

/**
 * 전체 중 순위 비율 (0~1): 나보다 작은 값이 몇 %인가
 * - 단위가 다른 점수(유사도 0~1, 가치 점수 0~수백)를 0~1로 맞춘다
 * - 같은 값은 같은 비율을 받는다 (반응이 없는 사진은 모두 0)
 * - 순서만 보므로 log(1 + 값)을 먼저 해도 결과가 같다. 그래서 log는 따로 하지 않는다
 */
export function percentileRanks(values: number[]): number[] {
  if (values.length <= 1) {
    return values.map(() => 0);
  }
  // 정렬했을 때 값이 처음 나오는 자리 = 나보다 작은 값의 개수
  const lessCount = new Map<number, number>();
  [...values]
    .sort((a, b) => a - b)
    .forEach((value, index) => {
      if (!lessCount.has(value)) {
        lessCount.set(value, index);
      }
    });
  return values.map(
    (value) => (lessCount.get(value) ?? 0) / (values.length - 1),
  );
}

// ① 유사도 (0~1). 0단계는 유사도가 없어 0이다
// 사진 벡터·취향 벡터(h)를 연결하면 이 함수만 바꾼다
export const similarityOf: (photoId: string) => number = () => 0;

/**
 * 사진별 최종 점수 (추천 기획서 vol.2 6-5)
 * ② = 프리셋 비율 × (사진 점수 순위 비율, 작가 점수 순위 비율, 새 작가 보너스 0/1)
 * 최종 = a × ① + b × ②
 * scores: 순위 비율의 기준 집합. 필터와 상관없이 전체 사진을 넘겨야 같은 사진이 늘 같은 점수를 받는다
 */
export function finalScores(
  scores: ValueScore[],
  goal: Goal = DEFAULT_GOAL,
): Map<string, number> {
  const weights = GOAL_PRESETS[goal];
  const photoRanks = percentileRanks(scores.map((s) => s.photoScore));
  const photographerRanks = percentileRanks(
    scores.map((s) => s.photographerScore),
  );

  return new Map(
    scores.map((score, index) => {
      const business =
        weights.photo * (photoRanks[index] ?? 0) +
        weights.photographer * (photographerRanks[index] ?? 0) +
        weights.newPhotographer * (score.isNewPhotographer ? 1 : 0);
      return [
        score.photoId,
        FINAL_SCORE_WEIGHTS.similarity * similarityOf(score.photoId) +
          FINAL_SCORE_WEIGHTS.business * business,
      ];
    }),
  );
}
