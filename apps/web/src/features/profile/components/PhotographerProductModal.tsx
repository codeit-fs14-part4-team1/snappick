'use client';

import { useId, useState, type FormEvent } from 'react';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';

import { useManagePhotographerProducts } from '../hooks/useManagePhotographerProducts';

import type {
  PhotographerProduct,
  CreatePhotographerProductInput,
} from '../types';

import styles from './PhotographerProductModal.module.css';

// 촬영 상품 등록·수정 모달 Props 정의
type PhotographerProductModalProps = {
  open: boolean;
  product: PhotographerProduct | null;
  onClose: () => void;
};

// 가격을 천 단위 구분 형식으로 변환함
function formatPrice(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9);

  return digits ? Number(digits).toLocaleString('ko-KR') : '';
}

export default function PhotographerProductModal({
  open,
  product,
  onClose,
}: PhotographerProductModalProps) {
  const formId = useId();

  const { showToast } = useToast();

  const { saveMutation, deleteMutation } = useManagePhotographerProducts();

  // 기존 상품이 있으면 수정 모드로 사용함
  const isEditing = product !== null;

  // 상품 입력값을 관리함
  const [name, setName] = useState(product?.name ?? '');

  const [price, setPrice] = useState(
    product ? product.price.toLocaleString('ko-KR') : '',
  );

  const [durationHours, setDurationHours] = useState(
    product ? String(product.durationMinutes / 60) : '',
  );

  const [photoCount, setPhotoCount] = useState(
    product ? String(product.photoCount) : '',
  );

  const [includesOriginal, setIncludesOriginal] = useState(
    product?.includesOriginal ?? true,
  );

  const [commonNotice, setCommonNotice] = useState(product?.commonNotice ?? '');

  // 상품 삭제 확인 화면의 표시 여부를 관리함
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const isBusy = saveMutation.isPending || deleteMutation.isPending;

  // API 요청 중에는 모달을 닫지 않도록 처리함
  const handleClose = () => {
    if (isBusy) return;

    onClose();
  };

  // 상품 입력값 검증 후 등록 또는 수정을 요청함
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) return;

    const trimmedName = name.trim();
    const priceValue = Number(price.replaceAll(',', ''));
    const hoursValue = Number(durationHours);
    const minutesValue = hoursValue * 60;
    const durationMinutes = Math.round(minutesValue);
    const photoCountValue = Number(photoCount);
    const trimmedNotice = commonNotice.trim();

    // 상품명을 확인함
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      showToast('상품명은 1~50자로 입력해 주세요.', 'error');
      return;
    }

    // 기본 가격을 확인함
    if (
      price === '' ||
      !Number.isInteger(priceValue) ||
      priceValue < 0 ||
      priceValue > 100_000_000
    ) {
      showToast('기본 가격은 0~100,000,000원으로 입력해 주세요.', 'error');
      return;
    }

    // 촬영 시간을 분 단위 정수로 변환하고 확인함
    if (
      durationHours.trim() === '' ||
      !Number.isFinite(minutesValue) ||
      Math.abs(minutesValue - durationMinutes) > 0.000001 ||
      durationMinutes < 60 ||
      durationMinutes > 2880
    ) {
      showToast('촬영 시간은 1~48시간 범위로 입력해 주세요.', 'error');
      return;
    }

    // 제공 사진 수를 확인함
    if (
      photoCount.trim() === '' ||
      !Number.isInteger(photoCountValue) ||
      photoCountValue < 1 ||
      photoCountValue > 10_000
    ) {
      showToast('제공 사진 수는 1~10,000장으로 입력해 주세요.', 'error');
      return;
    }

    // 공통 안내사항의 길이를 확인함
    if (trimmedNotice.length > 1000) {
      showToast('공통 안내사항은 1,000자 이하로 입력해 주세요.', 'error');
      return;
    }

    // 서버 요청에 필요한 상품 데이터를 생성함
    const input: CreatePhotographerProductInput = {
      name: trimmedName,
      price: priceValue,
      durationMinutes,
      photoCount: photoCountValue,
      includesOriginal,
      commonNotice: trimmedNotice || null,
    };

    // 상품 등록 또는 수정을 요청함
    saveMutation.mutate(
      {
        productId: product?.productId,
        input,
      },
      {
        onSuccess: () => {
          showToast(
            isEditing ? '촬영 상품을 수정했어요.' : '촬영 상품을 등록했어요.',
          );

          onClose();
        },

        onError: () => {
          showToast(
            isEditing
              ? '촬영 상품을 수정하지 못했어요.'
              : '촬영 상품을 등록하지 못했어요.',
            'error',
          );
        },
      },
    );
  };

  // 상품 삭제를 요청함
  const handleDelete = () => {
    if (!product || isBusy) return;

    deleteMutation.mutate(product.productId, {
      onSuccess: () => {
        showToast('촬영 상품을 삭제했어요.');
        onClose();
      },

      onError: () => {
        showToast('촬영 상품을 삭제하지 못했어요.', 'error');
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        isDeleteConfirmOpen
          ? '상품 삭제'
          : isEditing
            ? '상품 수정'
            : '상품 추가'
      }
      className={styles.modalSurface}
      footer={
        isDeleteConfirmOpen ? (
          <div className={styles.confirmActions}>
            <Button
              variant="outline"
              size="lg"
              disabled={isBusy}
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              취소
            </Button>

            <button
              type="button"
              className={styles.dangerButton}
              disabled={isBusy}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </button>
          </div>
        ) : (
          <div className={styles.footerActions}>
            {/* 수정 모드에서만 상품 삭제 버튼을 표시함 */}
            {isEditing ? (
              <button
                type="button"
                className={styles.deleteTrigger}
                disabled={isBusy}
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                상품 삭제
              </button>
            ) : (
              <span />
            )}

            <div className={styles.footerRight}>
              <Button
                variant="outline"
                size="lg"
                disabled={isBusy}
                onClick={handleClose}
              >
                취소
              </Button>

              <Button
                type="submit"
                form={formId}
                variant="primary"
                size="lg"
                disabled={isBusy}
              >
                {saveMutation.isPending ? '저장 중...' : '저장하기'}
              </Button>
            </div>
          </div>
        )
      }
    >
      {isDeleteConfirmOpen ? (
        // 상품 삭제 전에 사용자에게 확인함
        <div className={styles.deleteConfirm}>
          <p className={styles.deleteConfirmTitle}>이 상품을 삭제할까요?</p>

          <p className={styles.deleteConfirmDescription}>
            삭제하면 상품이 없어서 촬영 문의를 받을 수 없어요.
          </p>
        </div>
      ) : (
        <form
          id={formId}
          className={styles.form}
          onSubmit={handleSubmit}
          aria-busy={isBusy}
        >
          {/* 상품명 입력 */}
          <div className={styles.field}>
            <label htmlFor={`${formId}-name`} className={styles.label}>
              상품명 <span className={styles.required}>*</span>
            </label>

            <input
              id={`${formId}-name`}
              className={styles.input}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              required
            />
          </div>

          {/* 기본 가격과 촬영 시간을 가로로 배치함 */}
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor={`${formId}-price`} className={styles.label}>
                기본 가격 <span className={styles.required}>*</span>
              </label>

              <div className={styles.inputWrapper}>
                <input
                  id={`${formId}-price`}
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9,]+"
                  value={price}
                  onChange={(event) =>
                    setPrice(formatPrice(event.target.value))
                  }
                  required
                />

                <span className={styles.inputUnit}>원</span>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor={`${formId}-hours`} className={styles.label}>
                촬영 시간 <span className={styles.required}>*</span>
              </label>

              <div className={styles.inputWrapper}>
                <input
                  id={`${formId}-hours`}
                  className={styles.input}
                  type="number"
                  min={1}
                  max={48}
                  step="any"
                  value={durationHours}
                  onChange={(event) => setDurationHours(event.target.value)}
                  required
                />

                <span className={styles.inputUnit}>시간</span>
              </div>
            </div>
          </div>

          {/* 제공 사진 수 입력 */}
          <div className={styles.field}>
            <label htmlFor={`${formId}-count`} className={styles.label}>
              제공 사진 수 <span className={styles.required}>*</span>
            </label>

            <div className={styles.inputWrapper}>
              <input
                id={`${formId}-count`}
                className={styles.input}
                type="number"
                min={1}
                max={10000}
                step={1}
                value={photoCount}
                onChange={(event) => setPhotoCount(event.target.value)}
                required
              />

              <span className={styles.inputUnit}>장</span>
            </div>
          </div>

          {/* 결과물 전달 기간을 고정된 정책으로 표시함 */}
          <div className={styles.field}>
            <label className={styles.label}>결과물 전달 기간</label>

            <div className={styles.fixedValue}>촬영 다음 날부터 14일 이내</div>

            <p className={styles.fieldHint}>
              스냅픽 정책에 따라 결과물 전달 기간은 고정되어 있어요.
            </p>
          </div>

          {/* 원본 제공 여부 선택 */}
          <div className={styles.field}>
            <span className={styles.label}>원본 제공 여부 (선택)</span>

            <div className={styles.choiceGroup}>
              <button
                type="button"
                className={styles.choiceButton}
                data-selected={includesOriginal}
                aria-pressed={includesOriginal}
                onClick={() => setIncludesOriginal(true)}
              >
                제공
              </button>

              <button
                type="button"
                className={styles.choiceButton}
                data-selected={!includesOriginal}
                aria-pressed={!includesOriginal}
                onClick={() => setIncludesOriginal(false)}
              >
                미제공
              </button>
            </div>
          </div>

          {/* 공통 안내사항 입력 */}
          <div className={styles.field}>
            <label htmlFor={`${formId}-notice`} className={styles.label}>
              공통 안내사항 (선택)
            </label>

            <textarea
              id={`${formId}-notice`}
              className={styles.textarea}
              value={commonNotice}
              onChange={(event) => setCommonNotice(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="촬영 조건이나 추가 안내사항을 입력해 주세요."
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
