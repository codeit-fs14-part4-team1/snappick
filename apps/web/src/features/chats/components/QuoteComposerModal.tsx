'use client';

import { useId, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SchedulePicker from './SchedulePicker';
import TimePicker from './TimePicker';
import QuoteNoticeList from './QuoteNoticeList';
import { formatQuoteDate, getQuoteDeliveryDate } from '../quote';
import type { QuoteDraft, QuoteProduct } from '../quote';
import styles from './QuoteComposerModal.module.css';

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

function isValidInteger(value: number, min = 0) {
  return Number.isInteger(value) && value >= min && value <= 2147483647;
}

function QuoteDialog({
  onClose,
  products,
  onSubmit,
  initialQuote,
}: Omit<Props, 'open'>) {
  const id = useId();
  const [referenceDate] = useState(() =>
    new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [productId, setProductId] = useState('');
  const [quoteName, setQuoteName] = useState(initialQuote?.quoteName ?? '');
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
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
  const validDuration =
    duration.trim() !== '' &&
    Number.isFinite(minutesValue) &&
    Math.abs(minutesValue - minutes) <= 0.000001 &&
    minutes > 0;
  const count = photoCount === '' ? null : Number(photoCount);
  const validName = name.length > 0 && name.length <= 30;
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime);
  const validLocation = location.trim().length > 0 && location.length <= 50;
  const validNumbers =
    /^\d+$/.test(price) &&
    isValidInteger(amount) &&
    validDuration &&
    (count === null || (/^\d+$/.test(photoCount) && isValidInteger(count, 1)));
  const canSubmit =
    Boolean(initialQuote || selectedProduct) &&
    validName &&
    validDate &&
    validTime &&
    validLocation &&
    validNumbers &&
    includesOriginal !== null;

  function selectProduct(product: QuoteProduct) {
    setProductId(product.id);
    setQuoteName(product.name);
    setPrice(String(product.price));
    setDuration(String(product.durationMinutes / 60));
    setPhotoCount(String(product.photoCount));
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
          if (!selectedProduct && !initialQuote) {
            setError('촬영 상품을 선택해 주세요.');
            return;
          }
          const data = new FormData(event.currentTarget);
          if (!validName) {
            setError('견적명은 1~30자로 입력해 주세요.');
            return;
          }
          if (!validDate) {
            setError('촬영 날짜를 선택해 주세요.');
            return;
          }
          if (!validTime) {
            setError('촬영 시작 시간을 선택해 주세요.');
            return;
          }
          if (!validLocation) {
            setError('촬영 장소를 입력해 주세요.');
            return;
          }
          if (!validDuration) {
            setError('촬영 시간은 0분보다 큰 분 단위로 입력해 주세요.');
            return;
          }
          if (!validNumbers) {
            setError('금액·촬영 시간·사진 수를 올바르게 입력해 주세요.');
            return;
          }
          if (includesOriginal === null) {
            setError('원본 제공 여부를 선택해 주세요.');
            return;
          }
          submitting.current = true;
          setPending(true);
          setError('');
          try {
            await onSubmit({
              productId: selectedProduct?.id ?? '',
              quoteName: name,
              price: amount,
              durationMinutes: minutes,
              date,
              startTime,
              location: location.trim(),
              photoCount: count,
              includesOriginal,
              additionalNotice:
                String(data.get('additionalNotice') ?? '').trim() || null,
              commonNotice,
            });
            onClose();
          } catch {
            setError(
              '견적을 보내지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.',
            );
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
          <label className={styles.field}>
            <span>
              견적명 <RequiredMark />
            </span>
            <input
              name="quoteName"
              value={quoteName}
              onChange={(event) => setQuoteName(event.target.value)}
              required
              maxLength={30}
              aria-describedby={`${id}-quote-name-help`}
              placeholder="견적명을 입력해 주세요"
            />
            <span id={`${id}-quote-name-help`} className={styles.nameHelp}>
              {initialQuote
                ? '이전 견적명을 불러왔어요'
                : '다른 견적과 구분되게 고칠 수 있어요'}
              {' · '}
              {quoteName.length}/30
            </span>
          </label>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>
                견적 금액 <RequiredMark />
              </span>
              <QuoteNumberInput
                unit="원"
                required
                value={price}
                onChange={setPrice}
              />
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
                onChange={setDuration}
                invalid={duration !== '' && !validDuration}
              />
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
                onDateChange={setDate}
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
                onValueChange={setStartTime}
              />
            </div>
            <label className={`${styles.field} ${styles.full}`}>
              <span>
                촬영 장소 <RequiredMark />
              </span>
              <input
                name="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                required
                maxLength={50}
                placeholder="예) 서울숲 (성수동)"
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
            제공 사진
            <QuoteNumberInput
              unit="장"
              value={photoCount}
              onChange={setPhotoCount}
              placeholder="예) 40"
            />
          </label>
          <div
            className={styles.original}
            role="group"
            aria-labelledby={`${id}-original`}
          >
            <span id={`${id}-original`}>
              원본 제공 여부 <RequiredMark />
            </span>
            <button
              type="button"
              aria-pressed={includesOriginal === true}
              onClick={() => setIncludesOriginal(true)}
            >
              제공
            </button>
            <button
              type="button"
              aria-pressed={includesOriginal === false}
              onClick={() => setIncludesOriginal(false)}
            >
              미제공
            </button>
          </div>
          <div>
            <label className={styles.field}>
              추가 안내사항 (선택)
              <input
                name="additionalNotice"
                defaultValue={initialQuote?.additionalNotice ?? ''}
                maxLength={1000}
                placeholder="추가로 안내할 내용을 입력해 주세요"
              />
            </label>
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
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  unit: '원' | '시간' | '장';
  decimal?: boolean;
  required?: boolean;
  placeholder?: string;
  invalid?: boolean;
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
        maxLength={24}
        pattern={decimal ? '[0-9]+(?:\\.[0-9]+)?' : '[0-9,]+'}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
