'use client';

import { useState } from 'react';
import Image from 'next/image';

import Button from '@/components/ui/Button';
import GuestLoginModal from '@/components/ui/GuestLoginModal';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import StartChatButton from '@/features/chats/components/StartChatButton';
import { useTogglePhotographerSave } from '@/features/profile/hooks/useTogglePhotographerSave';

import styles from './PhotographerProfileInfo.module.css';

// 작가 기본 정보 컴포넌트에서 사용할 데이터 타입 정의
type PhotographerProfileInfoProps = {
  photographerId: string;
  nickname: string;
  profileImageUrl: string | null;
  saved: boolean;
  categories: string[];
  careerLabel: string | null;
  regions: string[];
  introduction: string | null;
  reviewCount: number;
  ratingAvg: number | null;
  savedCount?: number | null;
  completedCount?: number | null;
  isSelf?: boolean;
  isReady?: boolean;

  // 작가 본인의 프로필 편집 모드 진입을 처리함
  onEditProfile?: () => void;

  // 현재 프로필 편집 모드인지 확인함
  isEditingProfile?: boolean;

  // 기본 정보 수정 모달 열기를 처리함
  onEditBasicInfo?: () => void;

  // 현재 프로필을 조회하는 사용자의 계정 유형
  viewerAccountType?: 'USER' | 'PHOTOGRAPHER' | null;
};

// 숫자 데이터를 천 단위 구분 기호로 변환함
// 데이터가 없으면 '—' 반환
function formatCount(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString('ko-KR');
}

export default function PhotographerProfileInfo({
  photographerId,
  nickname,
  profileImageUrl,
  saved,
  categories,
  careerLabel,
  regions,
  introduction,
  reviewCount,
  ratingAvg,
  savedCount,
  completedCount,
  isSelf = false,
  isReady = true,
  onEditProfile,
  isEditingProfile = false,
  onEditBasicInfo,
  viewerAccountType = null,
}: PhotographerProfileInfoProps) {
  // 현재 인증 상태를 확인함
  const { authStatus } = useAuth();

  // 공통 Toast 메시지 표시 함수를 가져옴
  const { showToast } = useToast();

  // 비회원의 저장 요청 시 로그인 안내 모달 상태를 관리함
  const [isGuestLoginOpen, setIsGuestLoginOpen] = useState(false);

  // 비회원이 저장 버튼을 클릭하면 로그인 안내 모달을 표시함
  const handleGuestAction = () => {
    if (authStatus === 'unauthenticated' && viewerAccountType === null) {
      setIsGuestLoginOpen(true);
    }
  };

  // 작가 저장 및 저장 취소 Mutation을 사용함
  const saveMutation = useTogglePhotographerSave();

  // 계정 유형과 저장 상태에 따라 저장 버튼 클릭을 처리함
  const handleSaveClick = () => {
    // 비회원은 로그인 안내 모달을 표시함
    if (authStatus === 'unauthenticated') {
      handleGuestAction();
      return;
    }

    // 일반 사용자만 저장할 수 있으며 중복 요청을 방지함
    if (
      authStatus !== 'authenticated' ||
      viewerAccountType !== 'USER' ||
      saveMutation.isPending
    ) {
      return;
    }

    // 현재 저장 상태에 따라 저장 또는 저장 취소 API를 호출함
    saveMutation.mutate(
      {
        photographerId,
        saved,
      },
      {
        // API 요청이 성공하면 실제 저장 결과에 맞는 Toast를 표시함
        onSuccess: (response) => {
          showToast(
            response.saved ? '작가를 저장했어요.' : '작가 저장을 취소했어요.',
          );
        },

        // API 요청이 실패하면 오류 Toast를 표시함
        onError: () => {
          showToast('작가 저장 처리에 실패했어요.', 'error');
        },
      },
    );
  };

  // 작가 프로필 링크를 클립보드에 복사함
  const handleShareClick = async () => {
    // 현재 사진작가의 프로필 URL을 생성함
    const shareUrl = `${window.location.origin}/photographers/${photographerId}`;

    try {
      // 프로필 링크를 클립보드에 복사함
      await navigator.clipboard.writeText(shareUrl);

      // 링크 복사 성공 시 Toast를 표시함
      showToast('프로필 링크를 복사했어요.');
    } catch {
      // 링크 복사 실패 시 오류 Toast를 표시함
      showToast('프로필 링크를 복사하지 못했어요.', 'error');
    }
  };

  // 경력과 활동 지역을 하나의 문자열로 결합하고 빈 항목은 제외함
  const profileDetails = [careerLabel, ...regions].filter(Boolean).join(' · ');

  // 통계 데이터를 배열로 구성해 반복 렌더링에 사용함
  const statistics = [
    { label: '저장', value: formatCount(savedCount) },

    // 진행 건수가 있으면 '건' 단위를 붙이고 없으면 '—' 표시
    {
      label: '촬영 실적',
      value: completedCount == null ? '—' : `${formatCount(completedCount)}건`,
    },

    { label: '리뷰', value: formatCount(reviewCount) },
    {
      label: '평점',
      value: ratingAvg === null ? '—' : ratingAvg.toFixed(1),
    },
  ];

  return (
    <section className={styles.container} aria-label="작가 기본 정보">
      {/* 프로필 이미지 및 작가 정보 영역 */}
      <div className={styles.profile}>
        {/* 본인 미설정 상태에서 프로필 이미지가 없으면 회색 배경 적용 */}
        <div
          className={`${styles.profileImage} ${
            isSelf && !isReady && !profileImageUrl
              ? styles.profileImageUnset
              : ''
          }`}
        >
          {profileImageUrl ? (
            // 프로필 이미지가 있으면 해당 이미지 표시
            <Image
              src={profileImageUrl}
              alt={`${nickname} 프로필 사진`}
              fill
              sizes="(max-width: 767px) 96px, 160px"
              unoptimized
            />
          ) : (
            // 프로필 이미지가 없으면 기본 영역 표시
            <span
              className={styles.imagePlaceholder}
              role="img"
              aria-label="기본 프로필 이미지"
            />
          )}
        </div>

        {/* 작가 닉네임, 촬영 분야, 경력 및 활동 지역 */}
        <div className={styles.profileDetails}>
          {/* 촬영 분야가 있을 때만 태그 표시 */}
          {categories.length > 0 && (
            <div className={styles.categories}>
              {categories.map((category) => (
                <span key={category} className={styles.category}>
                  {category}
                </span>
              ))}
            </div>
          )}

          <h1 className={styles.nickname}>{nickname}</h1>

          {/* 경력 및 활동 지역 표시, 본인 미설정 시 안내 문구 표시 */}
          {profileDetails ? (
            <p className={styles.details}>{profileDetails}</p>
          ) : (
            isSelf &&
            !isReady && (
              <p className={styles.details}>경력 · 활동 지역을 입력해 주세요</p>
            )
          )}
        </div>

        {/* 작가 문의 및 본인 프로필 관리 버튼 영역 */}
        <div className={styles.profileActions}>
          {/* 작가 본인의 프로필 상태에 따라 설정 또는 수정 버튼을 표시함 */}
          {isSelf && (
            <Button
              variant={
                isEditingProfile ? 'outline' : isReady ? 'accent' : 'primary'
              }
              size="lg"
              fullWidth
              onClick={isEditingProfile ? onEditBasicInfo : onEditProfile}
            >
              {isEditingProfile
                ? '기본 정보 수정'
                : isReady
                  ? '프로필 수정'
                  : '프로필 설정하기'}
            </Button>
          )}

          {/* 일반 사용자와 비회원에게만 문의하기 버튼을 표시함 */}
          {!isSelf && viewerAccountType !== 'PHOTOGRAPHER' && (
            <StartChatButton
              key={photographerId}
              photographerId={photographerId}
            />
          )}

          {/* 작가 본인이 아닌 경우 공유 버튼 영역 표시 */}
          {!isSelf && (
            <div className={styles.iconActions}>
              {/* 일반 사용자와 비회원에게만 저장 버튼 표시 */}
              {viewerAccountType !== 'PHOTOGRAPHER' && (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={saved ? '작가 저장 취소' : '작가 저장'}
                  aria-pressed={saved}
                  onClick={handleSaveClick}
                  disabled={saveMutation.isPending}
                >
                  {/* 저장 여부에 따라 Figma 북마크 이미지 변경 */}
                  <Image
                    src={saved ? '/save-filled.png' : '/save.png'}
                    alt=""
                    width={48}
                    height={48}
                  />
                </button>
              )}

              {/* 다른 작가를 포함한 외부 방문자에게 공유 버튼 표시 */}
              <button
                type="button"
                className={styles.iconButton}
                aria-label="작가 프로필 공유"
                onClick={handleShareClick}
              >
                <Image src="/share.png" alt="" width={48} height={48} />
              </button>
            </div>
          )}
        </div>

        {/* 저장 수, 진행 건수, 리뷰 수, 평점 표시 */}
        <dl className={styles.statistics}>
          {statistics.map(({ label, value }) => (
            <div key={label} className={styles.statistic}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 작가 상세 소개 영역 */}
      <div className={styles.introduction}>
        <h2>상세 소개</h2>

        {/* 본인 미설정 상태에서는 전용 안내 문구 표시 */}
        <p>
          {introduction ||
            (isSelf && !isReady
              ? '아직 소개를 작성하지 않았어요.'
              : '등록된 소개가 없습니다.')}
        </p>
      </div>

      {/* 비회원의 저장 요청 시 기존 로그인 안내 모달을 표시함 */}
      <GuestLoginModal
        open={isGuestLoginOpen}
        onClose={() => setIsGuestLoginOpen(false)}
      />
    </section>
  );
}
