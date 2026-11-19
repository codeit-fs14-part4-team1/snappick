import type { PhotographerReviewSummaryResponse } from '../types';
import styles from './PhotographerReviewSummary.module.css';

// AI 리뷰 요약 컴포넌트에서 사용할 Props를 정의함
type PhotographerReviewSummaryProps = {
  data?: PhotographerReviewSummaryResponse;
  isPending?: boolean;
  isError?: boolean;
};

// 실제 API 응답에 따라 AI 리뷰 요약 카드를 표시함
export default function PhotographerReviewSummary({
  data,
  isPending = false,
  isError = false,
}: PhotographerReviewSummaryProps) {
  // API 연결 전에는 예시 데이터나 빈 카드를 표시하지 않음
  if (!data && !isPending && !isError) {
    return null;
  }

  // 사용 가능한 AI 요약 데이터가 있는지 확인함
  const hasSummary =
    (data?.status === 'READY' || data?.status === 'UPDATING') &&
    Boolean(data.summary?.trim());

  return (
    <section className={styles.summary} aria-labelledby="review-summary-title">
      {/* AI 리뷰 요약 제목을 표시함 */}
      <h2 id="review-summary-title" className={styles.title}>
        AI 리뷰 요약
      </h2>

      {/* API 조회 상태와 실제 요약 데이터에 따라 내용을 표시함 */}
      {isPending ? (
        <p className={styles.description} role="status">
          AI 리뷰 요약을 불러오는 중이에요.
        </p>
      ) : isError ? (
        <p className={styles.description} role="alert">
          AI 리뷰 요약을 불러오지 못했어요.
        </p>
      ) : data && hasSummary ? (
        <>
          {/* AI가 생성한 실제 리뷰 요약 문장을 표시함 */}
          <p className={styles.description}>{data.summary}</p>

          {/* 주요 키워드가 있는 경우에만 키워드 목록을 표시함 */}
          {data.highlights.length > 0 && (
            <ul className={styles.keywords} aria-label="주요 리뷰 키워드">
              {data.highlights.map((keyword) => (
                <li key={keyword.label} className={styles.keyword}>
                  {keyword.label} · {keyword.count}
                </li>
              ))}
            </ul>
          )}

          {/* 실제 요약에 사용된 리뷰 개수를 표시함 */}
          <p className={styles.note}>
            리뷰 {data.sourceReviewCount.toLocaleString('ko-KR')}개를 AI가
            요약했어요.
            {data.status === 'UPDATING' && ' 최신 리뷰를 반영하고 있어요.'}
          </p>
        </>
      ) : data?.status === 'UPDATING' ? (
        <p className={styles.description} role="status">
          AI가 리뷰를 분석하고 있어요.
        </p>
      ) : data?.status === 'NOT_ENOUGH' ? (
        <p className={styles.description}>
          리뷰가 3개 이상 등록되면 AI 요약을 생성할 수 있어요.
        </p>
      ) : (
        <p className={styles.description}>
          현재 AI 리뷰 요약을 제공할 수 없어요.
        </p>
      )}
    </section>
  );
}
