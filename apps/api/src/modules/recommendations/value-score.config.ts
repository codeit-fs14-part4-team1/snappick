/**
 * 가치 점수 설정 (추천 기획서 vol.2 6-4, 6-5)
 * 실사용 데이터가 없어 정한 임시 기준이다. 값은 여기서만 바꾼다
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// 행동 가중치: now: (좋아요 1, 저장 3, 예약 8)
export const ACTION_WEIGHTS = {
  like: 1,
  save: 3,
  reserve: 8,
} as const;

// 시간 감쇠 now: (오늘 100%, 30일 전 50%, 60일 전 25%)
export const DECAY_HALF_LIFE_MS = 30 * DAY_MS;

// 신규 작가 추가 점수 now: (작가 프로필 생성 시각 기준 14일)
export const NEW_PHOTOGRAPHER_PERIOD_MS = 14 * DAY_MS;

// 리뷰 평점 보정: now: (4.5 이상 x 1.2, 4.0 이상 x 1.0, 3.0 이상 x 0.8, 0점 이상 x 0.6)
// - 작가 평균 평점으로 구간을 찾아 작가 점수에 곱한다
// - 리뷰가 minReviews개 미만이면 보정하지 않는다 (표본값 부족으로 인한 쏠림 현상 방지용)
// - 더하지 않고 곱하는 이유: 리뷰수로 인한 쏠림 현상을 방지하기 위함
export const RATING_ADJUSTMENT = {
  minReviews: 3,
  ranges: [
    { min: 4.5, multiplier: 1.2 },
    { min: 4.0, multiplier: 1.0 },
    { min: 3.0, multiplier: 0.8 },
    { min: 0, multiplier: 0.6 },
  ],
} as const;

// 리뷰 평점 감쇠 여부 (true: 최근 가중 평균, false: 단순 평균)
export const DECAY_RATING_ADJUSTMENT = true;

// 배치 실행 간격 (하루 1번. 서버가 시작될 때도 1번 실행된다)
export const VALUE_SCORE_JOB_INTERVAL_MS = DAY_MS;
