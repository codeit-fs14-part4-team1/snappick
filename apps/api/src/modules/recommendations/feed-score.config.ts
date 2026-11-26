/**
 * 피드 요청 때 쓰는 점수 비율 (추천 기획서 vol.2 6-2, 6-5)
 * 재료(가치 점수)는 value-score.config.ts, 재료를 섞는 비율은 여기서 바꾼다
 */

// 최종 점수 = similarity × ① 유사도 + business × ② 비즈니스 점수
// 0단계는 유사도가 없어 ①이 모두 0이다 (순서는 ②만으로 정렬한 것과 같다)
export const FINAL_SCORE_WEIGHTS = {
  similarity: 0.8,
  business: 0.2,
} as const;

// 목표 프리셋: ② = photo × 사진 점수 + photographer × 작가 점수 + newPhotographer × 새 작가 보너스
// now: 기획서 예시 값
export const GOAL_PRESETS = {
  default: { photo: 0.4, photographer: 0.4, newPhotographer: 0.2 },
  reservation: { photo: 0.2, photographer: 0.7, newPhotographer: 0.1 },
  newPhotographer: { photo: 0.2, photographer: 0.2, newPhotographer: 0.6 },
} as const;

export type Goal = keyof typeof GOAL_PRESETS;

// 목표 프리셋은 2단계(goal 파라미터)에서 고른다. 그전까지는 기본만 쓴다
export const DEFAULT_GOAL: Goal = 'default';
