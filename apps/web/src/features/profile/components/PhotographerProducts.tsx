import styles from './PhotographerProducts.module.css';

// 촬영 상품 데이터 타입 정의
export type PhotographerProduct = {
  productId: string;
  name: string;
  price: number;
  durationMinutes: number;
  photoCount: number;
  includesOriginal: boolean;
  commonNotice: string | null;
};

type PhotographerProductsProps = {
  products: PhotographerProduct[];
};

// 촬영 시간을 시간과 분으로 변환함
function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}분`;
  if (remainingMinutes === 0) return `${hours}시간`;

  return `${hours}시간 ${remainingMinutes}분`;
}

export default function PhotographerProducts({
  products,
}: PhotographerProductsProps) {
  return (
    <section
      id="products"
      aria-labelledby="products-title"
      className={styles.products}
    >
      {/* 촬영 상품 섹션 제목 표시 */}
      <h2 id="products-title" className={styles.title}>
        촬영 상품
      </h2>

      {products.length === 0 ? (
        // 등록된 상품이 없는 경우 안내 문구 표시
        <p className={styles.emptyState}>아직 등록된 촬영 상품이 없습니다.</p>
      ) : (
        <>
          {/* 촬영 상품 목록 표시 */}
          <ul className={styles.productList}>
            {products.map((product) => (
              <li key={product.productId} className={styles.productCard}>
                {/* 상품명 및 기본 가격 표시 */}
                <h3 className={styles.productName}>{product.name}</h3>

                <p className={styles.price}>
                  {product.price.toLocaleString('ko-KR')}원~
                </p>

                {/* 촬영 상품 상세 정보 표시 */}
                <dl className={styles.details}>
                  <div className={styles.detail}>
                    <dt>촬영 시간</dt>
                    <dd>{formatDuration(product.durationMinutes)}</dd>
                  </div>

                  <div className={styles.detail}>
                    <dt>제공 사진</dt>
                    <dd>{product.photoCount}장</dd>
                  </div>

                  <div className={styles.detail}>
                    <dt>원본 제공</dt>
                    <dd>{product.includesOriginal ? '제공' : '미제공'}</dd>
                  </div>

                  <div className={styles.detail}>
                    <dt>전달 예정</dt>
                    <dd>촬영 다음 날부터 14일 이내</dd>
                  </div>
                </dl>

                {/* 상품별 공통 안내사항 표시 */}
                {product.commonNotice && (
                  <p className={styles.commonNotice}>{product.commonNotice}</p>
                )}
              </li>
            ))}
          </ul>

          {/* 상품 가격 안내 문구 표시 */}
          <p className={styles.priceNotice}>
            표시된 가격은 참고용이에요. 촬영 조건에 따라 달라질 수 있어요.
          </p>
        </>
      )}
    </section>
  );
}
