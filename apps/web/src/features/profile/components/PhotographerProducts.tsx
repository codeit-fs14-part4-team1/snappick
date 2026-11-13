'use client';

import { useState } from 'react';

import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

import PhotographerProductModal from './PhotographerProductModal';

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
  isSelf?: boolean;
  isReady?: boolean;
  isEditing?: boolean;

  // 프로필 기본 정보 5개 완료 여부를 전달받음
  isBasicInfoComplete: boolean;
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
  isSelf = false,
  isReady = true,
  isEditing = false,
  isBasicInfoComplete,
}: PhotographerProductsProps) {
  // 상품 등록 제한 및 처리 결과를 안내하는 Toast를 사용함
  const { showToast } = useToast();
  // 상품 등록·수정 모달 상태를 관리함
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // 수정할 상품을 관리하고 null이면 등록 모드로 사용함
  const [editingProduct, setEditingProduct] =
    useState<PhotographerProduct | null>(null);

  // 기본 정보 완료 여부를 확인한 뒤 상품 등록 모달을 표시함
  const handleCreateProduct = () => {
    // 필수 기본 정보가 미완료라면 상품 등록을 차단함
    if (!isBasicInfoComplete) {
      showToast(
        '촬영 상품을 등록하려면 먼저 프로필 기본 정보 설정을 완료해 주세요.',
        'error',
      );
      return;
    }

    // 기본 정보가 완료된 경우 상품 등록 모달을 표시함
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  // 상품 수정 모달을 표시함
  const handleEditProduct = (product: PhotographerProduct) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  return (
    <section
      id="products"
      aria-labelledby="products-title"
      className={styles.products}
    >
      {/* 촬영 상품 제목과 상품 관리 영역을 표시함 */}
      <div className={styles.heading}>
        <h2 id="products-title" className={styles.title}>
          촬영 상품
        </h2>

        {/* 작가 본인의 편집 모드에서 상품 등록 안내와 추가 버튼을 표시함 */}
        {isSelf && isEditing && (
          <div className={styles.headingActions}>
            <p className={styles.productLimitNotice}>
              상품은 최대 3개까지 등록할 수 있어요
            </p>

            {/* 상품이 3개 미만일 때만 추가 버튼을 표시함 */}
            {products.length < 3 && (
              <div className={styles.addProductButton}>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCreateProduct}
                >
                  + 상품 추가
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 상품이 없는 경우 본인 미설정 상태와 공개 상태를 구분함 */}
      {products.length === 0 ? (
        isSelf && !isReady ? (
          <div className={styles.emptyStateOwn}>
            {/* 작가 본인 미설정 상태의 상품 등록 안내 */}
            <p className={styles.emptyStateOwnTitle}>
              아직 등록한 상품이 없어요
            </p>
            <p className={styles.emptyStateOwnDescription}>
              상품은 최대 3개까지 등록할 수 있어요.
            </p>
          </div>
        ) : (
          // 공개 프로필에서는 기존 빈 상태 안내를 유지함
          <p className={styles.emptyState}>아직 등록된 촬영 상품이 없습니다.</p>
        )
      ) : (
        <>
          {/* 촬영 상품 목록 표시 */}
          <ul className={styles.productList}>
            {products.map((product) => (
              <li key={product.productId} className={styles.productCard}>
                {/* 촬영 상품명 표시 */}
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

                {/* 작가 본인 편집 모드에서 상품 수정 버튼 표시 */}
                {isSelf && isEditing && (
                  <div className={styles.productEditAction}>
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => handleEditProduct(product)}
                    >
                      상품 수정
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 상품이 있거나 본인 미설정 상태일 때 가격 안내 표시 */}
      {(products.length > 0 || (isSelf && !isReady)) && (
        <p className={styles.priceNotice}>
          표시된 가격은 참고용이에요. 촬영 조건에 따라 달라질 수 있어요.
        </p>
      )}

      {/* 촬영 상품 등록·수정 모달을 표시함 */}
      {isSelf && isEditing && isProductModalOpen && (
        <PhotographerProductModal
          open
          product={editingProduct}
          onClose={() => setIsProductModalOpen(false)}
        />
      )}
    </section>
  );
}
