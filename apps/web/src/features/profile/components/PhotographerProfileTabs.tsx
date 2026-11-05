import styles from './PhotographerProfileTabs.module.css';

type PhotographerProfileTabsProps = {
  portfolioCount: number;
  productCount: number;
  reviewCount: number;
};

export default function PhotographerProfileTabs({
  portfolioCount,
  productCount,
  reviewCount,
}: PhotographerProfileTabsProps) {
  // 작가 프로필 콘텐츠 항목 정의
  const tabs = [
    { id: 'portfolio', label: '포트폴리오', count: portfolioCount },
    { id: 'products', label: '촬영 상품', count: productCount },
    { id: 'reviews', label: '리뷰', count: reviewCount },
  ];

  return (
    // 작가 프로필 콘텐츠 항목 표시
    <div className={styles.tabs}>
      {tabs.map(({ id, label, count }) => (
        <span
          key={id}
          className={`${styles.tab} ${id === 'portfolio' ? styles.activeTab : ''}`}
        >
          {label} {count.toLocaleString('ko-KR')}
        </span>
      ))}
    </div>
  );
}
