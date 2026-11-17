import styles from './PhotographerReviewSummary.module.css';

// 실제 리뷰 분석 결과가 아닌 확인용 예시 데이터, api 연결시 삭제 예정
const DESIGN_PREVIEW = {
  description:
    '편하게 걷고 이야기하는 동안 자연스러운 모습이 담기고, 영화처럼 분위기 있는 사진이 나왔다는 후기가 많아요.',
  keywords: [
    { label: '편안한 촬영', count: 52 },
    { label: '영화 같은 분위기', count: 31 },
    { label: '자연스러운 결과물', count: 24 },
  ],
  note: '최근 리뷰 50개를 AI가 요약했어요',
} as const;

// API 연결 전 예시 데이터로 AI 리뷰 요약 카드를 표시함
export default function PhotographerReviewSummary() {
  return (
    <section className={styles.summary} aria-labelledby="review-summary-title">
      {/* AI 리뷰 요약 제목을 표시함 */}
      <h2 id="review-summary-title" className={styles.title}>
        AI 리뷰 요약
      </h2>

      {/* 작성된 예시 요약 문장을 표시함 */}
      <p className={styles.description}>{DESIGN_PREVIEW.description}</p>

      {/* 주요 키워드와 언급 횟수를 표시함 */}
      <ul className={styles.keywords} aria-label="주요 리뷰 키워드">
        {DESIGN_PREVIEW.keywords.map((keyword) => (
          <li key={keyword.label} className={styles.keyword}>
            {keyword.label} · {keyword.count}
          </li>
        ))}
      </ul>

      {/* 작성된 요약 범위 안내 문구를 표시함 */}
      <p className={styles.note}>{DESIGN_PREVIEW.note}</p>
    </section>
  );
}
