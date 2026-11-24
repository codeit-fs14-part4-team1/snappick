'use client';

import { useId, useState } from 'react';
import type { ReservationStatus } from '@snappick/shared';
import { useReservationReviewEligibility } from '../hooks/useReservationReview';
import type { ReviewBooking } from '@/features/my/reviews/types';
import { formatDateWithWeekday } from '@/utils/dateTime';
import { useConfirmReservationPurchase } from '../hooks/useConfirmReservationPurchase';

import {
  useReservationDeliverable,
  useCreateReservationDeliverable,
  useUpdateReservationDeliverable,
} from '../hooks/useReservationDeliverable';

import type {
  CreateReservationDeliverableInput,
  UpdateReservationDeliverableInput,
} from '../types';

import Button from '@/components/ui/Button';
import ReservationReviewModal from './ReservationReviewModal';
import ReservationDatePicker from './ReservationDatePicker';
import styles from './ReservationDeliverable.module.css';

type ReservationDeliverableProps = {
  reservationId: string;
  status: ReservationStatus;
  isPhotographer: boolean;
  isCancelPending: boolean;
};

// HTTP 또는 HTTPS 링크만 허용
function isValidLink(value: string) {
  try {
    const url = new URL(value);

    return (
      value.length <= 2000 &&
      (url.protocol === 'http:' || url.protocol === 'https:')
    );
  } catch {
    return false;
  }
}

// 한국 시간 기준 오늘 날짜를 YYYYMMDD 숫자로 반환
function getTodayKst() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return Number(`${getPart('year')}${getPart('month')}${getPart('day')}`);
}

// 만료일 형식, 실제 날짜 및 한국 시간 기준 오늘 이후 여부 검사
function isValidExpirationDate(value: string) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  return Number(`${match[1]}${match[2]}${match[3]}`) >= getTodayKst();
}

// 예약 상태와 계정 유형에 따라 결과물 전달 및 조회 영역을 표시
export default function ReservationDeliverable({
  reservationId,
  status,
  isPhotographer,
  isCancelPending,
}: ReservationDeliverableProps) {
  const linkId = useId();
  const expirationId = useId();
  const noticeId = useId();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 리뷰 작성 모달에 전달할 예약 정보
  const [reviewBooking, setReviewBooking] = useState<ReviewBooking | null>(
    null,
  );

  const [link, setLink] = useState('');
  const [expirationPeriod, setExpirationPeriod] = useState('');
  const [notice, setNotice] = useState('');

  const hasDeliverable =
    status === 'DELIVERED' || status === 'PURCHASE_CONFIRMED';

  const canDeliver =
    isPhotographer && status === 'SHOOT_COMPLETED' && !isCancelPending;

  const canEdit = isPhotographer && status === 'DELIVERED';

  // 일반 사용자는 결과물을 전달받은 예약만 구매 확정 가능
  const canConfirmPurchase = !isPhotographer && status === 'DELIVERED';

  // 구매 확정된 일반 사용자 예약에서만 리뷰 작성 가능 여부 조회
  const shouldCheckReviewEligibility =
    !isPhotographer && status === 'PURCHASE_CONFIRMED';

  // 이미 결과물이 등록된 예약에서만 결과물 조회
  const deliverableQuery = useReservationDeliverable(
    reservationId,
    hasDeliverable,
  );

  const createMutation = useCreateReservationDeliverable(reservationId);

  const updateMutation = useUpdateReservationDeliverable(reservationId);

  const confirmPurchaseMutation = useConfirmReservationPurchase(reservationId);

  // 해당 예약의 실제 리뷰 작성 가능 여부를 조회
  const reviewEligibilityQuery = useReservationReviewEligibility(
    reservationId,
    shouldCheckReviewEligibility,
  );

  // 서버에서 작성 가능 대상으로 확인된 예약만 리뷰 작성 허용
  const canWriteReview =
    shouldCheckReviewEligibility &&
    reviewEligibilityQuery.isSuccess &&
    Boolean(reviewEligibilityQuery.data);

  const deliverable = deliverableQuery.data;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const linkError =
    link.trim().length > 0 && !isValidLink(link.trim())
      ? '올바른 링크 형식이 아니예요. https://로 시작하는 주소를 입력해 주세요.'
      : null;

  const isExpirationUnchanged =
    isEditing && expirationPeriod === deliverable?.expirationPeriod;

  const expirationError =
    expirationPeriod.length > 0 &&
    !isExpirationUnchanged &&
    !isValidExpirationDate(expirationPeriod)
      ? '오늘 이후의 올바른 날짜를 YYYY.MM.DD 형식으로 입력해 주세요.'
      : null;

  const hasChanges =
    !isEditing ||
    link.trim() !== deliverable?.link ||
    expirationPeriod !== deliverable?.expirationPeriod ||
    (notice.trim() || null) !== (deliverable?.notice || null);

  const canSubmit =
    !isSaving &&
    isValidLink(link.trim()) &&
    (isExpirationUnchanged || isValidExpirationDate(expirationPeriod)) &&
    notice.trim().length <= 1000 &&
    hasChanges &&
    (isEditing ? canEdit : canDeliver);

  // 최초 결과물 전달 입력 영역 열기
  const handleOpenForm = () => {
    createMutation.reset();
    updateMutation.reset();

    setLink('');
    setExpirationPeriod('');
    setNotice('');
    setIsEditing(false);
    setIsFormOpen(true);
  };

  // 기존 결과물 정보를 입력값으로 불러오기
  const handleEdit = () => {
    if (!deliverable || !canEdit) {
      return;
    }

    updateMutation.reset();

    setLink(deliverable.link);
    setExpirationPeriod(deliverable.expirationPeriod);
    setNotice(deliverable.notice ?? '');
    setIsEditing(true);
    setIsFormOpen(true);
  };

  // 결과물 입력 및 수정 영역 닫기
  const handleCloseForm = () => {
    if (isSaving) {
      return;
    }

    setIsFormOpen(false);
    setIsEditing(false);

    createMutation.reset();
    updateMutation.reset();
  };

  // 결과물 등록 및 수정 API 요청
  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      if (isEditing) {
        if (!deliverable) {
          return;
        }

        const input: UpdateReservationDeliverableInput = {};

        // 기존 값과 달라진 항목만 수정 요청에 포함
        if (link.trim() !== deliverable.link) {
          input.link = link.trim();
        }

        if (expirationPeriod !== deliverable.expirationPeriod) {
          input.expirationPeriod = expirationPeriod;
        }

        if ((notice.trim() || null) !== (deliverable.notice || null)) {
          input.notice = notice.trim() || null;
        }

        if (Object.keys(input).length === 0) {
          return;
        }

        await updateMutation.mutateAsync(input);
      } else {
        const input: CreateReservationDeliverableInput = {
          link: link.trim(),
          expirationPeriod,
          ...(notice.trim() && {
            notice: notice.trim(),
          }),
        };

        await createMutation.mutateAsync(input);
      }

      // 서버 요청이 성공한 경우에만 입력 영역 닫기
      setIsFormOpen(false);
      setIsEditing(false);
    } catch {
      // 요청 실패 시 입력값을 유지하고 오류 메시지를 표시
    }
  };

  // 일반 사용자의 구매 확정 API 요청
  const handleConfirmPurchase = async () => {
    if (
      !canConfirmPurchase ||
      confirmPurchaseMutation.isPending ||
      confirmPurchaseMutation.isSuccess
    ) {
      return;
    }

    try {
      await confirmPurchaseMutation.mutateAsync();
    } catch {
      // 요청 실패 시 구매 확정 오류 메시지를 표시
    }
  };

  // 해당 예약의 리뷰 작성 모달 열기
  const handleOpenReviewModal = () => {
    const booking = reviewEligibilityQuery.data;

    if (!canWriteReview || !booking) {
      return;
    }

    setReviewBooking({
      reservationId: booking.reservationId,
      photographerId: booking.photographer?.photographerId,
      photographerName: booking.photographer?.nickname ?? '작가 정보 없음',
      quoteName: booking.quoteName ?? '견적 정보 없음',
      shootDate: booking.shootAt,
    });
  };

  const mutationError = isEditing ? updateMutation.error : createMutation.error;

  const showForm = isFormOpen && (isEditing ? canEdit : canDeliver);

  // 결과물 전달 및 조회가 필요하지 않은 상태
  if (!hasDeliverable && !canDeliver) {
    return null;
  }

  // 촬영 완료 상태에서 결과물 전달 버튼 표시
  if (canDeliver && !isFormOpen) {
    return (
      <section className={styles.deliverableSection} aria-label="결과물 전달">
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={isSaving}
          onClick={handleOpenForm}
        >
          결과물 전달하기
        </Button>
      </section>
    );
  }

  // 결과물 조회 중
  if (hasDeliverable && deliverableQuery.isPending) {
    return <p role="status">결과물 정보를 불러오는 중이에요.</p>;
  }

  // 결과물 조회 실패
  if (hasDeliverable && deliverableQuery.isError && !deliverable) {
    return (
      <section aria-label="결과물 조회 오류">
        <p role="alert">결과물 정보를 불러오지 못했어요.</p>

        <Button
          variant="outline"
          size="md"
          onClick={() => void deliverableQuery.refetch()}
          disabled={deliverableQuery.isFetching}
        >
          다시 시도
        </Button>
      </section>
    );
  }

  // 결과물 최초 등록 및 수정 입력 영역
  if (showForm) {
    return (
      <section className={styles.deliverableSection} aria-label="결과물 입력">
        <div className={styles.deliverableCard}>
          <h3 className={styles.deliverableTitle}>
            {isEditing ? '결과물 수정' : '결과물 전달하기'}
          </h3>

          <form
            className={styles.form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className={styles.field}>
              <label className={styles.label} htmlFor={linkId}>
                결과물 링크 <span className={styles.required}>*</span>
              </label>

              <input
                id={linkId}
                type="url"
                className={styles.input}
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://"
                maxLength={2000}
                aria-invalid={Boolean(linkError)}
                required
                disabled={isSaving}
              />

              {linkError && (
                <p className={styles.error} role="alert">
                  {linkError}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={expirationId}>
                링크 유효 기간 <span className={styles.required}>*</span>
              </label>

              <ReservationDatePicker
                id={expirationId}
                value={expirationPeriod}
                onChange={setExpirationPeriod}
                placeholder="YYYY.MM.DD"
                ariaLabel="링크 유효 기간"
                invalid={Boolean(expirationError)}
                disabled={isSaving}
              />

              {expirationError && (
                <p className={styles.error} role="alert">
                  {expirationError}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={noticeId}>
                납품 안내사항
              </label>

              <textarea
                id={noticeId}
                className={styles.textarea}
                value={notice}
                onChange={(event) => setNotice(event.target.value)}
                placeholder="고객에게 전달할 안내사항을 입력해 주세요."
                maxLength={1000}
                rows={1}
                disabled={isSaving}
              />
            </div>

            {mutationError && (
              <p className={styles.error} role="alert">
                {isEditing
                  ? '결과물을 수정하지 못했어요.'
                  : '결과물을 전달하지 못했어요.'}
                {' 다시 시도해 주세요.'}
              </p>
            )}

            <div className={styles.formActions}>
              <div className={styles.formButtons}>
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    fullWidth
                    disabled={isSaving}
                    onClick={handleCloseForm}
                  >
                    취소
                  </Button>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={!canSubmit}
                >
                  {isSaving
                    ? '저장 중...'
                    : isEditing
                      ? '수정하기'
                      : '결과물 전달하기'}
                </Button>
              </div>

              <p className={styles.deliverableHint}>
                {!isEditing && '결과물을 전달하면 고객에게 알림이 가요. '}
                고객이 구매를 확정하기 전까지 수정할 수 있어요.
              </p>
            </div>
          </form>
        </div>
      </section>
    );
  }

  // 결과물 전달 완료 및 구매 확정 이후 조회 영역
  if (hasDeliverable && deliverable) {
    const title =
      status === 'PURCHASE_CONFIRMED'
        ? isPhotographer
          ? '고객이 구매를 확정했어요'
          : '구매를 확정했어요'
        : isPhotographer
          ? '결과물을 전달했어요'
          : '결과물이 도착했어요';

    return (
      <section className={styles.deliverableSection} aria-label="전달된 결과물">
        <div className={styles.deliverableCard}>
          <h3 className={styles.deliverableTitle}>{title}</h3>

          <dl className={styles.deliverableInfo}>
            {/* 결과물 링크 */}
            <div className={styles.infoRow}>
              <dt>결과물 링크</dt>

              <dd className={styles.linkRow}>
                <span className={styles.linkValue}>{deliverable.link}</span>

                {isValidLink(deliverable.link) ? (
                  <a
                    className={styles.linkOpenButton}
                    href={deliverable.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    열기
                    <svg
                      className={styles.linkOpenIcon}
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M7 17 17 7M7 7h10v10" />
                    </svg>
                  </a>
                ) : (
                  <span className={styles.error}>유효하지 않은 링크</span>
                )}
              </dd>
            </div>

            {/* 링크 유효 기간 */}
            <div className={styles.infoRow}>
              <dt>링크 유효 기간</dt>

              <dd>
                {formatDateWithWeekday(
                  deliverable.expirationPeriod.replaceAll('.', '-'),
                ) || deliverable.expirationPeriod}
              </dd>
            </div>

            {/* 납품 안내 */}
            <div className={styles.infoRow}>
              <dt>납품 안내</dt>
              <dd>{deliverable.notice || '-'}</dd>
            </div>
          </dl>

          {/* 구매 확정 전 사진작가의 결과물 수정 기능 */}
          {canEdit && (
            <div className={styles.deliverableActions}>
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={handleEdit}
              >
                결과물 수정
              </Button>

              <p className={styles.deliverableHint}>
                고객이 구매를 확정하기 전까지 수정할 수 있어요. 수정하면
                고객에게 다시 알림이 가요.
              </p>
            </div>
          )}

          {/* 일반 사용자의 구매 확정 영역 */}
          {canConfirmPurchase && (
            <div className={styles.deliverableActions}>
              {confirmPurchaseMutation.isError && (
                <p className={styles.error} role="alert">
                  구매를 확정하지 못했어요. 다시 시도해 주세요.
                </p>
              )}

              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                disabled={
                  confirmPurchaseMutation.isPending ||
                  confirmPurchaseMutation.isSuccess
                }
                onClick={() => void handleConfirmPurchase()}
              >
                {confirmPurchaseMutation.isPending
                  ? '구매 확정 중...'
                  : '구매 확정'}
              </Button>
            </div>
          )}

          {/* 리뷰 작성 가능 여부 조회 실패 시 재시도 */}
          {shouldCheckReviewEligibility && reviewEligibilityQuery.isError && (
            <div className={styles.deliverableActions}>
              <p className={styles.error} role="alert">
                리뷰 작성 가능 여부를 확인하지 못했어요.
              </p>

              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                disabled={reviewEligibilityQuery.isFetching}
                onClick={() => void reviewEligibilityQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          )}

          {/* 구매 확정 이후 일반 사용자의 리뷰 작성 기능 */}
          {canWriteReview && (
            <div className={styles.deliverableActions}>
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                onClick={handleOpenReviewModal}
              >
                리뷰 작성하기
              </Button>
            </div>
          )}

          {/* 예약 전용 리뷰 작성 모달 */}
          {shouldCheckReviewEligibility && reviewBooking && (
            <ReservationReviewModal
              booking={reviewBooking}
              onClose={() => setReviewBooking(null)}
            />
          )}
        </div>
      </section>
    );
  }

  return null;
}
