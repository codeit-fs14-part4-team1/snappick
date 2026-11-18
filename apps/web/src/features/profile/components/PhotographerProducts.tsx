'use client';

import { useState } from 'react';

import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

import PhotographerProductModal from './PhotographerProductModal';

import type { CreatePhotographerProductInput } from '../types';

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
  isBasicInfoComplete: boolean;
  // 편집 중 변경 사항은 서버에 저장하지 않고 상위 임시 상태에 반영함
  onApplyProduct?: (
    productId: string | null,
    input: CreatePhotographerProductInput,
  ) => void;
  onDeleteProduct?: (productId: string) => void;
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
  onApplyProduct,
  onDeleteProduct,
}: PhotographerProductsProps) {
  // 상품 등록 제한 및 처리 결과를 안내하는 Toast를 사용함
  const { showToast } = useToast();

  // 상품 등록·수정 모달 상태를 관리함
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // 수정할 상품을 관리하고 null이면 등록 모드로 사용함
  const [editingProduct, setEditingProduct] =
    useState<PhotographerProduct | null>(null);

  // 임시 프로필 기본 정보 완료 여부를 확인한 뒤 상품 등록 모달을 표시함
  const handleCreateProduct = () => {
    if (!isBasicInfoComplete) {
      showToast(
        '촬영 상품을 등록하려면 먼저 프로필 기본 정보 설정을 완료해 주세요.',
        'error',
      );
      return;
    }

    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  // 상품 수정 모달을 표시함
  const handleEditProduct = (product: PhotographerProduct) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  // 상품 모달의 저장은 API 호출이 아닌 임시 적용으로 처리함
  const handleApplyProduct = (
    productId: string | null,
    input: CreatePhotographerProductInput,
  ) => {
    onApplyProduct?.(productId, input);
    setIsProductModalOpen(false);
    showToast(
      '상품 변경 사항을 임시 적용했어요. 수정 완료를 눌러 저장해 주세요.',
    );
  };

  // 상품 삭제 역시 임시 목록에서만 삭제함
  const handleDeleteProduct = (productId: string) => {
    onDeleteProduct?.(productId);
    setIsProductModalOpen(false);
    showToast('상품 삭제를 임시 적용했어요. 수정 완료를 눌러 저장해 주세요.');
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
      {/* 상품이 없는 경우 준비 상태와 관계없이 빈 상태 박스를 표시함 */}
      {products.length === 0 ? (
        <div className={styles.emptyStateOwn}>
          <p className={styles.emptyStateOwnTitle}>
            {isSelf ? '아직 등록한 상품이 없어요' : '아직 등록된 상품이 없어요'}
          </p>

          {/* 본인 프로필이 준비되지 않은 경우 상품 등록 제한을 안내함 */}
          {isSelf && !isReady && (
            <p className={styles.emptyStateOwnDescription}>
              상품은 최대 3개까지 등록할 수 있어요.
            </p>
          )}
        </div>
      ) : (
        <ul className={styles.productList}>
          {products.map((product) => (
            <li key={product.productId} className={styles.productCard}>
              <h3 className={styles.productName}>{product.name}</h3>

              <p className={styles.price}>
                {product.price.toLocaleString('ko-KR')}원~
              </p>

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

              {/* 안내 문구가 있는 상품은 상세 정보 아래에 표시함 */}
              {product.commonNotice?.trim() && (
                <p className={styles.commonNotice}>{product.commonNotice}</p>
              )}

              {/* 작가 본인 편집 모드에서 상품 수정 버튼을 표시함 */}
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
      )}

      {/* 상품 등록 여부와 관계없이 가격 안내 문구를 표시함 */}
      <p className={styles.priceNotice}>
        표시된 가격은 참고용이에요. 촬영 조건에 따라 달라질 수 있어요.
      </p>

      {/* 상품 등록·수정·삭제를 임시 상태에만 반영함 */}
      {isSelf && isEditing && isProductModalOpen && (
        <PhotographerProductModal
          open
          product={editingProduct}
          onClose={() => setIsProductModalOpen(false)}
          onApply={handleApplyProduct}
          onDelete={handleDeleteProduct}
        />
      )}
    </section>
  );
}
