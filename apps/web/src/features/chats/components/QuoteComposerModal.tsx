'use client';

import { useId, useRef, useState, type FormEventHandler } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import NaverMapPicker from '@/features/map/components/NaverMapPicker';
import { ApiError } from '@/lib/api';
import SchedulePicker from './SchedulePicker';
import TimePicker from './TimePicker';
import QuoteNoticeList from './QuoteNoticeList';
import {
  formatQuoteDate,
  getQuoteDeliveryDate,
  parseQuoteShootAt,
} from '../quote';
import type { QuoteDraft, QuoteProduct } from '../quote';
import styles from './QuoteComposerModal.module.css';

const PAST_SHOOT_TIME_MESSAGE =
  '시간이 유효하지 않아요. 시간을 다시 선택해 주세요.';

type Props = {
  open: boolean;
  onClose: () => void;
  products: QuoteProduct[];
  onSubmit: (quote: QuoteDraft) => void | Promise<void>;
  initialQuote?: QuoteDraft;
};

export default function QuoteComposerModal({ open, ...props }: Props) {
  return open ? <QuoteDialog {...props} /> : null;
}

function QuoteDialog({
  onClose,
  products,
  onSubmit,
  initialQuote,
}: Omit<Props, 'open'>) {
  const id = useId();
  const [durationError, setDurationError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [photoCountError, setPhotoCountError] = useState('');
  const [referenceDate] = useState(() =>
    new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [productId, setProductId] = useState('');
  const [quoteName, setQuoteName] = useState(initialQuote?.quoteName ?? '');
  const [additionalNotice, setAdditionalNotice] = useState(
    initialQuote?.additionalNotice ?? '',
  );
  const [price, setPrice] = useState(
    initialQuote ? String(initialQuote.price) : '',
  );
  const [duration, setDuration] = useState(
    initialQuote ? String(initialQuote.durationMinutes / 60) : '',
  );
  const [photoCount, setPhotoCount] = useState(
    initialQuote?.photoCount == null ? '' : String(initialQuote.photoCount),
  );
  const [includesOriginal, setIncludesOriginal] = useState<boolean | null>(
    initialQuote?.includesOriginal ?? null,
  );
  const [date, setDate] = useState(initialQuote?.date ?? '');
  const [startTime, setStartTime] = useState(initialQuote?.startTime ?? '');
  const [location, setLocation] = useState(initialQuote?.location ?? '');
  const [locationLat, setLocationLat] = useState(
    initialQuote?.locationLat ?? null,
  );
  const [locationLng, setLocationLng] = useState(
    initialQuote?.locationLng ?? null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [shootTimeError, setShootTimeError] = useState('');
  const shootTimeErrorId = `${id}-shoot-time-error`;
  const submitting = useRef(false);
  const [mapOpen, setMapOpen] = useState(false);
  const openMapPicker = () => setMapOpen(true);
  const selectedProduct = initialQuote
    ? undefined
    : products.find((product) => product.id === productId);
  const commonNotice = selectedProduct
    ? (selectedProduct.commonNotice ?? '')
    : (initialQuote?.commonNotice ?? '');
  const deliveryDate = getQuoteDeliveryDate(date);
  const name = quoteName.trim();
  const amount = Number(price);
  const minutesValue = Number(duration) * 60;
  const minutes = Math.round(minutesValue);
  const hasFractionalMinute = Math.abs(minutesValue - minutes) > 0.000001;
  const hasDuration = duration.trim() !== '' && Number.isFinite(minutesValue);
  const durationInRange = minutesValue >= 60 && minutesValue <= 2_880;
  const durationValidation =
    !hasDuration || !durationInRange
      ? '촬영 시간은 1~48시간 범위로 입력해 주세요.'
      : hasFractionalMinute
        ? '촬영 시간은 1분 단위로 입력해 주세요.'
        : '';
  const count = Number(photoCount);
  const validName = name.length > 0 && name.length <= 50;
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime);
  const validLocation =
    location.trim().length > 0 &&
    locationLat !== null &&
    Number.isFinite(locationLat) &&
    locationLat >= -90 &&
    locationLat <= 90 &&
    locationLng !== null &&
    Number.isFinite(locationLng) &&
    locationLng >= -180 &&
    locationLng <= 180;
  const validPrice = /^\d+$/.test(price) && amount <= 100_000_000;
  const priceValidation = validPrice
    ? ''
    : '0~100,000,000원으로 입력해 주세요.';
  const photoCountValidation =
    Number.isInteger(count) && count >= 1 && count <= 10_000
      ? ''
      : '제공 사진 수는 1~10,000장으로 입력해 주세요.';
  const canSubmit =
    Boolean(initialQuote || selectedProduct) &&
    Boolean(
      name && date && startTime && location.trim() && price && duration,
    ) &&
    photoCount !== '' &&
    !priceError &&
    !durationError &&
    !photoCountError &&
    includesOriginal !== null;

  function selectProduct(product: QuoteProduct) {
    setProductId(product.id);
    setQuoteName(product.name);
    setPrice(String(product.price));
    setPriceError('');
    setDuration(String(product.durationMinutes / 60));
    setDurationError('');
    setPhotoCount(String(product.photoCount));
    setPhotoCountError('');
    setIncludesOriginal(product.includesOriginal);
    setError('');
  }

  return (
    <Modal
      open
      title={initialQuote ? '견적 수정' : '견적 작성'}
      className={styles.modal}
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      onClose={() => {
        if (!submitting.current) onClose();
      }}
    >
      <p className={styles.intro}>
        {initialQuote
          ? '보낸 견적을 고쳐서 다시 보내요'
          : '촬영 상품을 골라 시작하면 내용이 복사돼요'}
      </p>
      <form
        className={styles.form}
        aria-label={initialQuote ? '견적 수정' : '견적 작성'}
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current) return;
          setError('');
          setShootTimeError('');
          if (!selectedProduct && !initialQuote) {
            setError('촬영 상품을 선택해 주세요.');
            return;
          }
          const data = new FormData(event.currentTarget);
          if (!validName) {
            setError('견적명은 1~50자로 입력해 주세요.');
            return;
          }
          if (!validDate) {
            setError('촬영 날짜를 선택해 주세요.');
            return;
          }
          if (!validTime) {
            setShootTimeError('촬영 시작 시간을 선택해 주세요.');
            return;
          }
          if (parseQuoteShootAt(date, startTime).getTime() <= Date.now()) {
            setShootTimeError(PAST_SHOOT_TIME_MESSAGE);
            return;
          }
          if (!validLocation) {
            setError('지도에서 촬영 장소를 선택해 주세요.');
            return;
          }
          if (durationValidation || priceValidation || photoCountValidation) {
            setDurationError(durationValidation);
            setPriceError(priceValidation);
            setPhotoCountError(photoCountValidation);
            return;
          }
          if (includesOriginal === null) {
            setError('원본 제공 여부를 선택해 주세요.');
            return;
          }
          submitting.current = true;
          setPending(true);
          try {
            await onSubmit({
              productId: selectedProduct?.id ?? '',
              quoteName: name,
              price: amount,
              durationMinutes: minutes,
              date,
              startTime,
              location: location.trim(),
              locationLat,
              locationLng,
              photoCount: count,
              includesOriginal,
              additionalNotice:
                String(data.get('additionalNotice') ?? '').trim() || null,
              commonNotice,
            });
            onClose();
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.code === 'QUOTE_SHOOT_TIME_PASSED'
            ) {
              setShootTimeError(PAST_SHOOT_TIME_MESSAGE);
            } else {
              setError(
                '견적을 보내지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.',
              );
            }
          } finally {
            submitting.current = false;
            setPending(false);
          }
        }}
      >
        {!initialQuote && (
          <fieldset className={styles.productSection} disabled={pending}>
            <legend>
              촬영 상품 선택 <RequiredMark />
            </legend>
            {products.length === 0 ? (
              <p className={styles.empty}>
                등록된 촬영 상품이 없어요. 상품을 등록한 뒤 견적을 작성해
                주세요.
              </p>
            ) : (
              <div className={styles.products}>
                {products.map((product) => (
                  <label key={product.id} className={styles.product}>
                    <input
                      type="radio"
                      name="product"
                      value={product.id}
                      checked={product.id === productId}
                      onChange={() => selectProduct(product)}
                      required
                    />
                    <span>
                      <strong>{product.name}</strong>
                      <span>{product.price.toLocaleString('ko-KR')}원</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}

        <fieldset className={styles.fields} disabled={pending}>
          <div className={styles.field}>
            <div className={styles.nameHeading}>
              <label htmlFor={`${id}-quote-name`}>
                견적명 <RequiredMark />
              </label>
              <span id={`${id}-quote-name-count`} className={styles.nameHelp}>
                {quoteName.length} / 50
              </span>
            </div>
            <input
              id={`${id}-quote-name`}
              name="quoteName"
              value={quoteName}
              onChange={(event) => setQuoteName(event.target.value)}
              required
              maxLength={50}
              aria-describedby={
                initialQuote
                  ? `${id}-quote-name-count`
                  : `${id}-quote-name-help ${id}-quote-name-count`
              }
              placeholder="견적명을 입력해 주세요"
            />
            {!initialQuote && (
              <span id={`${id}-quote-name-help`} className={styles.nameHelp}>
                다른 견적과 구분되게 고칠 수 있어요
              </span>
            )}
          </div>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>
                견적 금액 <RequiredMark />
              </span>
              <QuoteNumberInput
                unit="원"
                required
                value={price}
                onChange={(value) => {
                  setPrice(value);
                  setPriceError('');
                }}
                invalid={Boolean(priceError)}
                onBlur={() => setPriceError(price ? priceValidation : '')}
                describedBy={priceError ? `${id}-price-error` : undefined}
                onInvalid={(event) => {
                  if (event.currentTarget.validity.valueMissing) {
                    event.preventDefault();
                    setPriceError('견적 금액을 입력해 주세요.');
                  }
                }}
              />
              <span
                id={`${id}-price-error`}
                className={styles.fieldError}
                role="alert"
              >
                {priceError}
              </span>
            </label>
            <label className={styles.field}>
              <span>
                촬영 시간 <RequiredMark />
              </span>
              <QuoteNumberInput
                unit="시간"
                decimal
                required
                value={duration}
                onChange={(value) => {
                  setDuration(value);
                  setDurationError('');
                }}
                invalid={Boolean(durationError)}
                onBlur={() =>
                  setDurationError(duration ? durationValidation : '')
                }
                describedBy={durationError ? `${id}-duration-error` : undefined}
              />
              <span
                id={`${id}-duration-error`}
                className={styles.fieldError}
                role="alert"
              >
                {durationError}
              </span>
            </label>
            <div className={styles.field}>
              <span>
                촬영 날짜 <RequiredMark />
              </span>
              <SchedulePicker
                referenceDate={referenceDate}
                dateOnly
                presentation="modal"
                value={date}
                onDateChange={(value) => {
                  setDate(value);
                  setShootTimeError('');
                }}
                triggerClassName={styles.dateTrigger}
              />
            </div>
            <div className={styles.field}>
              <span>
                촬영 시작 시간 <RequiredMark />
              </span>
              <TimePicker
                value={startTime}
                date={date}
                errorId={shootTimeError ? shootTimeErrorId : undefined}
                onValueChange={(value) => {
                  setStartTime(value);
                  setShootTimeError('');
                }}
              />
              {shootTimeError && (
                <p
                  id={shootTimeErrorId}
                  className={styles.fieldError}
                  role="alert"
                >
                  {shootTimeError}
                </p>
              )}
            </div>
            <label className={`${styles.field} ${styles.full}`}>
              <span>
                촬영 장소 <RequiredMark />
              </span>
              <input
                name="location"
                value={location}
                readOnly
                onClick={openMapPicker}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openMapPicker();
                  }
                }}
                required
                placeholder="클릭해서 지도에서 촬영 장소를 선택해 주세요"
              />
            </label>
          </div>
          <p className={styles.delivery}>
            <strong className={styles.deliveryTitle}>납품 기한</strong>
            <strong className={styles.deliveryDate}>
              {deliveryDate
                ? `${formatQuoteDate(deliveryDate.replaceAll('.', '-'))}까지`
                : '촬영 날짜를 선택해 주세요'}
            </strong>
            <span>· 플랫폼 정책으로 정해져 바꿀 수 없어요</span>
          </p>
        </fieldset>

        <fieldset className={styles.fields} disabled={pending}>
          <label className={styles.field}>
            <span>
              제공 사진 <RequiredMark />
            </span>
            <QuoteNumberInput
              unit="장"
              required
              value={photoCount}
              onChange={(value) => {
                setPhotoCount(value);
                setPhotoCountError('');
              }}
              onBlur={() =>
                setPhotoCountError(photoCount ? photoCountValidation : '')
              }
              invalid={Boolean(photoCountError)}
              describedBy={
                photoCountError ? `${id}-photo-count-error` : undefined
              }
            />
            <span
              id={`${id}-photo-count-error`}
              className={styles.fieldError}
              role="alert"
            >
              {photoCountError}
            </span>
          </label>
          <div
            className={styles.original}
            role="group"
            aria-labelledby={`${id}-original`}
          >
            <span id={`${id}-original`}>
              원본 제공 여부 <RequiredMark />
            </span>
            <Chip
              aria-pressed={includesOriginal === true}
              onClick={() => setIncludesOriginal(true)}
            >
              제공
            </Chip>
            <Chip
              aria-pressed={includesOriginal === false}
              onClick={() => setIncludesOriginal(false)}
            >
              미제공
            </Chip>
          </div>
          <div className={styles.field}>
            <div className={styles.nameHeading}>
              <label htmlFor={`${id}-additional-notice`}>
                추가 안내사항 (선택)
              </label>
              <span id={`${id}-notice-count`} className={styles.nameHelp}>
                {additionalNotice.length} / 1000
              </span>
            </div>
            <input
              id={`${id}-additional-notice`}
              name="additionalNotice"
              value={additionalNotice}
              onChange={(event) =>
                setAdditionalNotice(event.currentTarget.value)
              }
              maxLength={1000}
              aria-describedby={`${id}-notice-count`}
              placeholder="추가로 안내할 내용을 입력해 주세요"
            />
          </div>
          <div className={styles.notice}>
            <div className={styles.noticeHeading}>
              <strong>공통 안내사항</strong>
            </div>
            {commonNotice.trim() ? (
              <QuoteNoticeList text={commonNotice} />
            ) : (
              <p>등록된 공통 안내사항이 없습니다.</p>
            )}
          </div>
        </fieldset>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={pending || !canSubmit}>
            {pending
              ? '보내는 중…'
              : initialQuote
                ? '수정한 견적 보내기'
                : '채팅으로 견적 보내기'}
          </Button>
        </div>
      </form>
      {mapOpen && (
        <Modal
          open
          title="촬영 장소 선택"
          className={styles.mapModal}
          onClose={() => setMapOpen(false)}
        >
          <p className={styles.intro}>
            지도를 클릭하거나 주소를 검색해 위치를 골라 주세요.
          </p>
          <NaverMapPicker
            onSelect={(picked) => {
              setLocation(picked.address);
              setLocationLat(picked.lat);
              setLocationLng(picked.lng);
              setError('');
              setMapOpen(false);
            }}
          />
        </Modal>
      )}
    </Modal>
  );
}

function RequiredMark() {
  return (
    <span className={styles.required} aria-label="필수">
      *
    </span>
  );
}

function QuoteNumberInput({
  value,
  onChange,
  unit,
  decimal = false,
  required = false,
  invalid,
  describedBy,
  onInvalid,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  unit: '원' | '시간' | '장';
  decimal?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onInvalid?: FormEventHandler<HTMLInputElement>;
  onBlur?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const display =
    value && !focused
      ? unit === '원'
        ? Number(value).toLocaleString('ko-KR')
        : value
      : value;
  return (
    <span className={styles.numberField}>
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={display}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onInvalid={onInvalid}
        maxLength={24}
        pattern={decimal ? undefined : '[0-9,]+'}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onChange={(event) => {
          const next = event.target.value.replaceAll(',', '');
          if ((decimal ? /^\d*(\.\d*)?$/ : /^\d*$/).test(next)) onChange(next);
        }}
      />
      <span className={styles.unit} aria-hidden="true">
        {unit}
      </span>
    </span>
  );
}
