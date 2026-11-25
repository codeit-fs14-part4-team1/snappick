'use client';

import Image from 'next/image';

import { useMyPageAccount } from '@/features/my/components/MyPageLayout';
import { useReservationDetail } from '../hooks/useReservationDetail';
import type { ReservationStatus } from '@snappick/shared';
import { formatReservationDDay } from '../utils/formatReservationDDay';
import { useState } from 'react';
import { formatDateWithWeekday, formatTime } from '@/utils/dateTime';
import { useToast } from '@/components/ui/ToastProvider';
import { useUpdateReservationCancel } from '../hooks/useReservationCancel';
import { useRouter } from 'next/navigation';

import Modal from '@/components/ui/Modal';
import ReservationNotice from './ReservationNotice';
import ReservationCancelModal from './ReservationCancelModal';
import ReservationCancelRequestModal from './ReservationCancelRequestModal';
import ReservationDeliverable from './ReservationDeliverable';
import ReservationProgress from './ReservationProgress';
import StatusBadge from '@/components/ui/StatusBadge';
import ReservationDetailActions from './ReservationDetailActions';
import Button from '@/components/ui/Button';
import NaverMapView from '@/features/map/components/NaverMapView';
import { naverMapSearchUrl } from '@/features/map/naver-maps';

import styles from './ReservationDetail.module.css';

// 예약 상세 페이지 제목과 화면 표시용 예약번호
function ReservationDetailHeading({
  reservationNumber,
}: {
  reservationNumber?: string;
}) {
  return (
    <div className={styles.pageHeading}>
      <h1 id="my-page-title" className={styles.pageTitle}>
        예약 상세
      </h1>

      {reservationNumber && (
        <p className={styles.reservationNumber}>
          예약 번호 {reservationNumber}
        </p>
      )}
    </div>
  );
}

// 공통 날짜 유틸을 사용해 날짜와 시간을 표시
function formatDateTime(value: string) {
  const date = formatDateWithWeekday(value);
  const time = formatTime(value);

  if (!date || !time) {
    return '정보 없음';
  }

  return `${date} ${time}`;
}

// 날짜만 표시할 때 사용
function formatDateOnly(value: string) {
  return formatDateWithWeekday(value) || '정보 없음';
}

// 결제 수단 및 결제 제공사를 화면에 표시할 문구로 변환
function formatPaymentMethod(method: string, provider: string) {
  if (method === 'EASY_PAY' && provider === 'TOSS') {
    return '간편결제 (토스페이먼츠)';
  }

  if (method === 'EASY_PAY') {
    return '간편결제';
  }

  return '정보 없음';
}

// 예약 상태에 따라 공통 상태 배지를 표시
function renderStatusBadge(status: ReservationStatus) {
  switch (status) {
    case 'CONFIRMED':
      return <StatusBadge variant="confirmed">예약 확정</StatusBadge>;

    case 'SHOOT_COMPLETED':
      return <StatusBadge variant="shootCompleted">촬영 완료</StatusBadge>;

    case 'DELIVERED':
      return <StatusBadge variant="delivered">결과물 전달</StatusBadge>;

    case 'PURCHASE_CONFIRMED':
      return <StatusBadge variant="purchaseConfirmed">구매 확정</StatusBadge>;

    case 'CANCELED':
      return <StatusBadge variant="canceled">예약 취소</StatusBadge>;

    default:
      return <span>{status}</span>;
  }
}

// 예약 상세 정보 및 조회 상태를 표시
export default function ReservationDetail({
  reservationId,
}: {
  reservationId: string;
}) {
  const account = useMyPageAccount();
  const { showToast } = useToast();
  const router = useRouter();

  // 사진작가의 고객 취소 요청 반려 처리
  const rejectCancelMutation = useUpdateReservationCancel(reservationId);

  const isRejecting = rejectCancelMutation.isPending;

  // 취소 요청 반려 확인 모달의 열림 상태
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const { data, isPending, isError, isFetching, refetch } =
    useReservationDetail(reservationId);

  // 일반 사용자 취소 요청 모달
  const [isCancelRequestModalOpen, setIsCancelRequestModalOpen] =
    useState(false);

  if (isPending) {
    return (
      <>
        <ReservationDetailHeading />

        <p role="status">예약 상세 정보를 불러오는 중이에요.</p>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <ReservationDetailHeading />

        <div role="alert">
          <p>예약 상세 정보를 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            다시 시도
          </button>
        </div>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <ReservationDetailHeading />

        <p role="status">예약 정보를 찾을 수 없어요.</p>
      </>
    );
  }

  // 현재 예약의 견적서와 연결된 기존 채팅방 ID
  const chatRoomId = data.quote?.chatRoomId?.trim();

  // 예약과 연결된 기존 채팅방으로 이동
  const handleMoveToChat = () => {
    if (!chatRoomId) {
      return;
    }

    router.push(`/chats/${encodeURIComponent(chatRoomId)}`);
  };

  const isPhotographer = account.accountType === 'PHOTOGRAPHER';
  const isCancelPending = data.cancelRequest?.status === 'PENDING';
  const counterpart = isPhotographer ? data.user : data.photographer;

  // 예약 취소 완료 여부
  const isCanceled = data.status === 'CANCELED';

  // 최종 취소 사유를 우선 표시
  const cancelReason =
    data.cancelRequest?.photographerReason?.trim() ||
    data.cancelRequest?.userReason?.trim() ||
    '정보 없음';

  // 예약 취소 처리 일시
  const canceledAt = data.cancelRequest?.processedAt ?? null;

  // 예약 취소를 처리한 사진작가 정보
  const cancelProcessorName = isPhotographer
    ? '사진작가 (본인)'
    : (data.photographer?.nickname ?? '사진작가');

  // 사진작가가 직접 예약을 취소할 수 있는 상태인지 확인
  const canPhotographerCancelDirectly =
    isPhotographer &&
    data.status === 'CONFIRMED' &&
    data.canRequestCancel &&
    !isCancelPending;

  // 예약 확정 상태에서만 촬영일까지 남은 날짜를 표시
  const dDay =
    data.status === 'CONFIRMED' ? formatReservationDDay(data.shootAt) : null;

  // 고객 취소 요청 반려 모달 닫기
  const handleCloseRejectModal = () => {
    if (isRejecting) {
      return;
    }

    rejectCancelMutation.reset();
    setIsRejectModalOpen(false);
  };

  // 사진작가가 고객의 취소 요청을 반려
  const handleRejectCancelRequest = async () => {
    if (
      !isPhotographer ||
      !isCancelPending ||
      !data.cancelRequest ||
      data.cancelRequest.requestedByMe ||
      isRejecting ||
      rejectCancelMutation.isSuccess
    ) {
      return;
    }

    try {
      await rejectCancelMutation.mutateAsync({
        cancelRequestId: data.cancelRequest.cancelRequestId,
        input: {
          status: 'REJECTED',
        },
      });

      showToast('취소 요청을 반려했어요.');

      setIsRejectModalOpen(false);
      rejectCancelMutation.reset();
    } catch {
      showToast('취소 요청을 반려하지 못했어요. 다시 시도해 주세요.', 'error');
    }
  };

  return (
    <>
      <ReservationDetailHeading reservationNumber={data.reservationNumber} />

      <article className={styles.card} aria-label="예약 상세">
        {/* 예약 상태 및 요약 정보 */}
        <header className={styles.header}>
          <div className={styles.statusRow}>
            {renderStatusBadge(data.status)}

            {isCancelPending && (
              <StatusBadge variant="cancelRequested">취소 요청 중</StatusBadge>
            )}

            {dDay && <span className={styles.dDay}>{dDay}</span>}
          </div>

          <h2 className={styles.reservationTitle}>
            {data.quote?.name ?? '예약명 없음'}
          </h2>

          <p className={styles.reservationSummary}>
            <time dateTime={data.shootAt}>{formatDateTime(data.shootAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{data.location}</span>
          </p>
        </header>

        {/* 예약 진행 상태 */}
        {data.status !== 'CANCELED' && (
          <div className={styles.progress}>
            <ReservationProgress
              status={data.status}
              createdAt={data.createdAt}
              shootAt={data.shootAt}
              deliveredAt={data.deliveredAt}
              purchaseConfirmedAt={data.purchaseConfirmedAt}
            />
          </div>
        )}

        {/* 예약 취소 완료 안내 */}
        {isCanceled && (
          <section
            className={styles.canceledSection}
            aria-label="예약 취소 완료 정보"
          >
            <div className={styles.canceledPanel}>
              <h3 className={styles.canceledTitle}>예약이 취소됐어요</h3>

              <dl className={styles.canceledInfoList}>
                <div className={styles.canceledInfoRow}>
                  <dt>취소 사유</dt>
                  <dd>{cancelReason}</dd>
                </div>

                <div className={styles.canceledInfoRow}>
                  <dt>처리</dt>
                  <dd>
                    {canceledAt ? (
                      <>
                        {cancelProcessorName}
                        {' · '}
                        <time dateTime={canceledAt}>
                          {formatDateTime(canceledAt)}
                        </time>
                      </>
                    ) : (
                      '정보 없음'
                    )}
                  </dd>
                </div>

                <div className={styles.canceledInfoRow}>
                  <dt>환불</dt>
                  <dd>취소·환불 규정에 따라 처리돼요</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        {/* 예약 상태 및 계정 유형별 결과물 전달·조회 영역 */}
        <ReservationDeliverable
          key={reservationId}
          reservationId={reservationId}
          status={data.status}
          isPhotographer={isPhotographer}
          isCancelPending={isCancelPending}
        />

        {/* 취소 요청 상태에 따른 안내 */}
        {isCancelPending &&
          data.cancelRequest &&
          (isPhotographer && !data.cancelRequest.requestedByMe ? (
            <section
              className={styles.cancelRequestPanel}
              aria-label="고객 취소 요청"
            >
              <p className={styles.cancelRequestTitle}>
                {counterpart?.nickname ?? '고객'}님이 취소를 요청했어요.
                <span className={styles.cancelRequestDate}>
                  {' · '}
                  <time dateTime={data.cancelRequest.requestedAt}>
                    {formatDateTime(data.cancelRequest.requestedAt)}
                  </time>
                </span>
              </p>

              <p className={styles.cancelRequestReason}>
                요청 사유: {data.cancelRequest.userReason ?? '정보 없음'}
              </p>
              {/* 모달 UI 구현 전까지 버튼 비활성화 */}
              <div className={styles.cancelRequestButtons}>
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  disabled={isRejecting}
                  onClick={() => setIsRejectModalOpen(true)}
                >
                  반려하고 예약 진행
                </Button>

                <Button
                  variant="danger"
                  size="md"
                  fullWidth
                  disabled={isRejecting}
                  onClick={() => setIsCancelModalOpen(true)}
                >
                  취소 확정
                </Button>
              </div>
            </section>
          ) : (
            <div className={styles.cancelNotice} role="status">
              <strong className={styles.cancelNoticeTitle}>
                취소를 요청했어요
                {data.cancelRequest?.requestedAt && (
                  <>
                    {' · '}
                    <time dateTime={data.cancelRequest.requestedAt}>
                      {formatDateTime(data.cancelRequest.requestedAt)}
                    </time>
                  </>
                )}
              </strong>

              <p className={styles.cancelNoticeDescription}>
                작가님이 확정하거나 반려하기 전까지 예약은 유지되고 진행이
                멈춰요.
              </p>
            </div>
          ))}

        {/* 예약 정보 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>예약 정보</h3>

          <dl className={styles.infoList}>
            <div className={styles.infoRow}>
              <dt>촬영 일시</dt>
              <dd>
                <time dateTime={data.shootAt}>
                  {formatDateTime(data.shootAt)}
                </time>
              </dd>
            </div>

            <div className={styles.infoRow}>
              <dt>촬영 장소</dt>
              <dd>
                <div className={styles.locationDetails}>
                  <span>{data.location}</span>
                  {data.location.trim() && (
                    <a
                      className={styles.locationLink}
                      href={naverMapSearchUrl(data.location.trim())}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="지도보기 (네이버 지도, 새 탭)"
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="8"
                        height="10"
                        viewBox="0 0 8 10"
                        fill="none"
                      >
                        <path
                          d="M4 0C1.8 0 0 1.73333 0 3.93333C0 6.86667 4 10 4 10C4 10 8 6.86667 8 3.93333C8 1.73333 6.2 0 4 0ZM4 2.4C4.86667 2.4 5.53333 3.06667 5.53333 3.93333C5.53333 4.8 4.86667 5.46667 4 5.46667C3.13333 5.46667 2.46667 4.8 2.46667 3.93333C2.46667 3.06667 3.13333 2.4 4 2.4Z"
                          fillRule="evenodd"
                          clipRule="evenodd"
                          fill="white"
                        />
                      </svg>
                      지도보기
                    </a>
                  )}
                </div>
                {data.locationCoords && (
                  <div className={styles.locationMap}>
                    <NaverMapView
                      lat={data.locationCoords.lat}
                      lng={data.locationCoords.lng}
                    />
                  </div>
                )}
              </dd>
            </div>

            <div className={styles.infoRow}>
              <dt>촬영 시간</dt>
              <dd>
                {data.durationMinutes !== null
                  ? `${data.durationMinutes}분`
                  : '정보 없음'}
              </dd>
            </div>

            <div className={styles.infoRow}>
              <dt>제공 사진</dt>
              <dd>
                {data.photoCount !== null
                  ? `${data.photoCount}장`
                  : '정보 없음'}
              </dd>
            </div>

            {/* 견적서에 포함된 원본 제공 여부 */}
            <div className={styles.infoRow}>
              <dt>원본 제공</dt>
              <dd>
                {data.quote
                  ? data.quote.includesOriginal
                    ? '포함'
                    : '미포함'
                  : '정보 없음'}
              </dd>
            </div>

            <div className={styles.infoRow}>
              <dt>납품 기한</dt>
              <dd>
                {data.deliveryDueDate
                  ? `${formatDateOnly(data.deliveryDueDate)}까지`
                  : '정보 없음'}
              </dd>
            </div>
          </dl>
        </section>

        {/* 견적서의 추가 안내사항 및 공통 안내사항 */}
        <ReservationNotice
          additionalNotice={data.quote?.additionalNotice}
          commonNotice={data.quote?.commonNotice}
        />

        {/* 결제 정보 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>결제 정보</h3>

          <dl className={styles.infoList}>
            <div className={styles.infoRow}>
              <dt>결제 금액</dt>
              <dd>{data.totalAmount.toLocaleString('ko-KR')}원</dd>
            </div>

            {/* 실제 결제 수단을 표시 */}
            <div className={styles.infoRow}>
              <dt>결제 수단</dt>
              <dd className={data.payment ? undefined : styles.unavailable}>
                {data.payment
                  ? formatPaymentMethod(
                      data.payment.paymentMethod,
                      data.payment.paymentProvider,
                    )
                  : '-'}
              </dd>
            </div>

            {/* 실제 결제 일시를 표시 */}
            <div className={styles.infoRow}>
              <dt>결제 일시</dt>
              <dd
                className={
                  data.payment?.paidAt ? undefined : styles.unavailable
                }
              >
                {data.payment?.paidAt ? (
                  <time dateTime={data.payment.paidAt}>
                    {formatDateTime(data.payment.paidAt)}
                  </time>
                ) : (
                  '-'
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* 예약 상대방 정보 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {isPhotographer ? '고객 정보' : '작가 정보'}
          </h3>

          <div className={styles.counterpart}>
            {counterpart?.profileImageUrl ? (
              <Image
                src={counterpart.profileImageUrl}
                alt=""
                width={40}
                height={40}
                className={styles.avatar}
                unoptimized
              />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true" />
            )}

            <strong className={styles.counterpartName}>
              {counterpart?.nickname ?? '상대방 정보 없음'}
            </strong>
          </div>
        </section>

        {/* 예약 상태 및 계정 유형별 하단 액션 */}
        <ReservationDetailActions
          status={data.status}
          isPhotographer={isPhotographer}
          canRequestCancel={data.canRequestCancel && !isCancelPending}
          onMoveToChat={chatRoomId ? handleMoveToChat : undefined}
          onRequestCancel={
            !isPhotographer && data.status === 'CONFIRMED'
              ? () => setIsCancelRequestModalOpen(true)
              : undefined
          }
          onCancelReservation={
            canPhotographerCancelDirectly
              ? () => setIsCancelModalOpen(true)
              : undefined
          }
        />

        {/* 고객 취소 요청 반려 확인 모달 */}
        {isPhotographer &&
          isCancelPending &&
          !data.cancelRequest?.requestedByMe && (
            <Modal
              open={isRejectModalOpen}
              onClose={handleCloseRejectModal}
              closeOnEscape={!isRejecting}
              closeOnBackdrop={!isRejecting}
              title="취소 요청을 반려할까요?"
              description={`반려하면 예약이 그대로 진행되고 ${
                counterpart?.nickname ?? '고객'
              }님에게 알림이 가요. 하고 싶은 말은 채팅으로 전해 주세요.`}
              variant="confirm"
              footer={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRejecting}
                    onClick={handleCloseRejectModal}
                  >
                    닫기
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isRejecting || rejectCancelMutation.isSuccess}
                    onClick={() => void handleRejectCancelRequest()}
                  >
                    {isRejecting ? '처리 중...' : '반려하기'}
                  </Button>
                </>
              }
            />
          )}

        {/* 사진작가 예약 취소 모달: 고객 요청 수락 및 직접 취소 공통 */}
        {isPhotographer &&
          (canPhotographerCancelDirectly ||
            (isCancelPending && !data.cancelRequest?.requestedByMe)) && (
            <ReservationCancelModal
              reservationId={reservationId}
              cancelRequestId={
                isCancelPending
                  ? data.cancelRequest?.cancelRequestId
                  : undefined
              }
              open={isCancelModalOpen}
              onClose={() => setIsCancelModalOpen(false)}
              customerName={counterpart?.nickname ?? '고객'}
              shootAt={data.shootAt}
              location={data.location}
              requestedAt={
                isCancelPending ? data.cancelRequest?.requestedAt : undefined
              }
              requestReason={
                isCancelPending
                  ? (data.cancelRequest?.userReason ?? undefined)
                  : undefined
              }
            />
          )}

        {/* 일반 사용자 예약 취소 요청 모달 */}
        {!isPhotographer &&
          data.status === 'CONFIRMED' &&
          data.canRequestCancel &&
          !isCancelPending && (
            <ReservationCancelRequestModal
              reservationId={reservationId}
              open={isCancelRequestModalOpen}
              onClose={() => setIsCancelRequestModalOpen(false)}
              photographerName={counterpart?.nickname ?? '사진작가'}
              shootAt={data.shootAt}
              location={data.location}
            />
          )}
      </article>
    </>
  );
}
