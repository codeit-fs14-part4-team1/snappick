'use client';

import { useId, useState, type FormEvent } from 'react';

import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';

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

  // 프로필 변경 사항을 서버에 저장 중인지 확인함
  isSavingEdit?: boolean;
  // 상위 컴포넌트의 임시 상품 목록만 변경함
  onApply: (
    productId: string | null,
    input: CreatePhotographerProductInput,
  ) => void;
  onDelete: (productId: string) => void;
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
  onApply,
  onDelete,
  isSavingEdit = false,
}: PhotographerProductModalProps) {
  const formId = useId();

  const { showToast } = useToast();

  // 기존 상품이 있으면 수정 모드로 사용함
  const isEditing = product !== null;

  // 상품 입력값을 관리함
  const [name, setName] = useState(product?.name ?? '');

  const [price, setPrice] = useState(
    product ? product.price.toLocaleString('ko-KR') : '',
  );
  const [priceError, setPriceError] = useState('');

  const [durationHours, setDurationHours] = useState(
    product ? String(product.durationMinutes / 60) : '',
  );
  const [durationError, setDurationError] = useState('');

  const [photoCount, setPhotoCount] = useState(
    product ? String(product.photoCount) : '',
  );

  const [includesOriginal, setIncludesOriginal] = useState(
    product?.includesOriginal ?? true,
  );

  const [commonNotice, setCommonNotice] = useState(product?.commonNotice ?? '');

  // 상품 삭제 확인 화면의 표시 여부를 관리함
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const priceValue = Number(price.replaceAll(',', ''));
  const hoursValue = Number(durationHours);
  const minutesValue = hoursValue * 60;
  const durationMinutes = Math.round(minutesValue);

  // 기본 가격은 1원 이상 1억 원 이하의 정수만 허용함
  const priceValidation =
    Number.isInteger(priceValue) && priceValue >= 1 && priceValue <= 100_000_000
      ? ''
      : '1~100,000,000원으로 입력해 주세요.';

  const durationValidation =
    !Number.isFinite(hoursValue) || hoursValue < 1 || hoursValue > 48
      ? '촬영 시간은 1~48시간 범위로 입력해 주세요.'
      : Math.abs(minutesValue - durationMinutes) > 0.000001
        ? '촬영 시간은 1분 단위로 입력해 주세요.'
        : '';

  // 필수 항목과 입력값이 유효한 경우에만 적용을 허용함
  const canApply =
    Boolean(name.trim() && price && durationHours && photoCount) &&
    !priceValidation &&
    !durationValidation &&
    !priceError &&
    !durationError;

  // 서버 저장 중에는 모달을 닫지 않도록 보호함
  const handleClose = () => {
    if (isSavingEdit) return;

    onClose();
  };

  // 상품 입력값을 검증한 뒤 임시 상품 목록에 적용함
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 서버 저장 중에는 상품 변경 사항을 임시 적용하지 않음
    if (isSavingEdit) return;

    const trimmedName = name.trim();
    const photoCountValue = Number(photoCount);
    const trimmedNotice = commonNotice.trim();

    // 상품명을 확인함
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      showToast('상품명은 1~50자로 입력해 주세요.', 'error');
      return;
    }

    // 기본 가격을 확인함
    if (priceValidation || durationValidation) {
      setPriceError(priceValidation);
      setDurationError(durationValidation);
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

    // 실제 API는 상단의 수정 완료 버튼을 누를 때만 호출함
    onApply(product?.productId ?? null, input);
  };

  // 삭제를 확정해도 서버에서 삭제하지 않고 임시 목록에서만 제거함
  const handleDelete = () => {
    // 서버 저장 중에는 상품 삭제를 차단함
    if (!product || isSavingEdit) return;

    onDelete(product.productId);
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
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isSavingEdit}
            >
              취소
            </Button>

            <button
              type="button"
              className={styles.dangerButton}
              onClick={handleDelete}
              disabled={isSavingEdit}
            >
              삭제
            </button>
          </div>
        ) : (
          <div className={styles.footerActions}>
            {/* 수정 모드에서만 상품 삭제 버튼을 표시함 */}
            {isEditing ? (
              <button
                type="button"
                className={styles.deleteTrigger}
                onClick={() => setIsDeleteConfirmOpen(true)}
                disabled={isSavingEdit}
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
                onClick={handleClose}
                disabled={isSavingEdit}
              >
                취소
              </Button>

              <Button
                type="submit"
                form={formId}
                variant="primary"
                size="lg"
                disabled={isSavingEdit || !canApply}
              >
                적용
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
            삭제는 임시 적용되며, 최종 삭제는 수정 완료를 눌렀을 때 반영돼요.
          </p>
        </div>
      ) : (
        <form id={formId} className={styles.form} onSubmit={handleSubmit}>
          {/* 상품명 입력 */}
          <div className={styles.field}>
            <div className={styles.labelWithCount}>
              <label htmlFor={`${formId}-name`} className={styles.label}>
                상품명 <span className={styles.required}>*</span>
              </label>
              <p id={`${formId}-name-help`} className={styles.fieldHint}>
                {name.length} / 50
              </p>
            </div>

            <input
              id={`${formId}-name`}
              className={styles.input}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              aria-describedby={`${formId}-name-help`}
              disabled={isSavingEdit}
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
                  onChange={(event) => {
                    setPrice(formatPrice(event.target.value));
                    setPriceError('');
                  }}
                  aria-invalid={Boolean(priceError) || undefined}
                  onBlur={() => setPriceError(price ? priceValidation : '')}
                  aria-describedby={
                    priceError ? `${formId}-price-error` : undefined
                  }
                  onInvalid={(event) => {
                    if (event.currentTarget.validity.valueMissing) {
                      event.preventDefault();
                      setPriceError('기본 가격을 입력해 주세요.');
                    }
                  }}
                  required
                />

                <span className={styles.inputUnit}>원</span>
              </div>
              <p
                id={`${formId}-price-error`}
                className={styles.fieldError}
                role="alert"
              >
                {priceError}
              </p>
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
                  step="any"
                  value={durationHours}
                  onChange={(event) => {
                    setDurationHours(event.target.value);
                    setDurationError('');
                  }}
                  aria-invalid={Boolean(durationError) || undefined}
                  onBlur={() =>
                    setDurationError(durationHours ? durationValidation : '')
                  }
                  aria-describedby={
                    durationError ? `${formId}-hours-error` : undefined
                  }
                  required
                />

                <span className={styles.inputUnit}>시간</span>
              </div>
              <p
                id={`${formId}-hours-error`}
                className={styles.fieldError}
                role="alert"
              >
                {durationError}
              </p>
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
              {/* 원본 제공 선택 */}
              <Chip
                aria-pressed={includesOriginal}
                onClick={() => setIncludesOriginal(true)}
                disabled={isSavingEdit}
              >
                제공
              </Chip>

              {/* 원본 미제공 선택 */}
              <Chip
                aria-pressed={!includesOriginal}
                onClick={() => setIncludesOriginal(false)}
                disabled={isSavingEdit}
              >
                미제공
              </Chip>
            </div>
          </div>

          {/* 공통 안내사항 입력 */}
          <div className={styles.field}>
            <div className={styles.labelWithCount}>
              <label htmlFor={`${formId}-notice`} className={styles.label}>
                공통 안내사항 (선택)
              </label>
              <p id={`${formId}-notice-count`} className={styles.fieldHint}>
                {commonNotice.length} / 1000
              </p>
            </div>

            <textarea
              id={`${formId}-notice`}
              className={styles.textarea}
              value={commonNotice}
              onChange={(event) => {
                const textarea = event.currentTarget;
                const value = textarea.value.slice(0, textarea.maxLength);
                if (textarea.value !== value) textarea.value = value;
                setCommonNotice(value);
              }}
              maxLength={1000}
              aria-describedby={`${formId}-notice-count`}
              rows={4}
              placeholder="촬영 조건이나 추가 안내사항을 입력해 주세요."
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
