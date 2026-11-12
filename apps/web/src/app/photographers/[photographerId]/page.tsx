'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import PhotographerBasicInfoModal from '@/features/profile/components/PhotographerBasicInfoModal';

import { CategoryLabel, RegionLabel } from '@/constants/enum-labels';
import { useAuth } from '@/features/auth/context/AuthContext';

import { usePhotographerProfile } from '@/features/profile/hooks/usePhotographerProfile';
import { usePhotographerPhotos } from '@/features/photos/hooks/usePhotographerPhotos';
import { usePhotographerProducts } from '@/features/profile/hooks/usePhotographerProducts';
import { usePhotographerReviews } from '@/features/profile/hooks/usePhotographerReviews';
import { usePhotographerReadiness } from '@/features/profile/hooks/usePhotographerReadiness';

import PhotographerProfileInfo from '@/features/profile/components/PhotographerProfileInfo';
import PhotographerProfileTabs from '@/features/profile/components/PhotographerProfileTabs';
import PhotographerPortfolio from '@/features/profile/components/PhotographerPortfolio';
import PhotographerProducts from '@/features/profile/components/PhotographerProducts';

import PhotographerReviews, {
  type PhotographerReview,
} from '@/features/profile/components/PhotographerReviews';

import PhotographerPreparing from '@/features/profile/components/PhotographerPreparing';
import styles from './PhotographerProfileEdit.module.css';

// 변경된 정책에 따라 프로필 필수 항목 5개를 정의함
const REQUIRED_PROFILE_CHECKS = [
  { key: 'profileImage', label: '프로필 이미지' },
  { key: 'regions', label: '활동 지역' },
  { key: 'categories', label: '촬영 카테고리' },
  { key: 'career', label: '경력' },
  { key: 'introduction', label: '상세 소개' },
] as const;

export default function PhotographerProfilePage() {
  const router = useRouter();

  // 현재 로그인한 사용자 정보를 가져옴
  const { user } = useAuth();

  // 프로필 수정 완료 및 필수 항목 누락 안내에 사용함
  const { showToast } = useToast();

  // URL에서 조회할 작가 ID를 가져옴
  const { photographerId } = useParams<{ photographerId: string }>();

  // 현재 선택한 리뷰 페이지 번호를 관리함
  const [reviewPage, setReviewPage] = useState(1);

  // 작가 본인의 프로필 편집 모드 진입 여부를 관리함
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // 기본 정보 수정 모달의 열림 상태를 관리함
  const [isBasicInfoModalOpen, setIsBasicInfoModalOpen] = useState(false);

  // 실제 작가 프로필 정보를 조회함
  const {
    data: photographer,
    isPending,
    isError,
  } = usePhotographerProfile(photographerId);

  // 사진작가 본인이 편집 중이면 접근 경로와 관계없이 준비 상태를 조회함
  const readinessQuery = usePhotographerReadiness(
    isEditingProfile && photographer?.isSelf === true,
  );

  // 공개 가능한 프로필 또는 작가 본인인지 확인함
  const canFetchContent =
    photographer?.isReady === true || photographer?.isSelf === true;

  // 조회가 허용된 경우 API 응답의 실제 작가 ID를 사용함
  const contentPhotographerId = canFetchContent ? photographer?.id : undefined;

  // 실제 작가 ID로 포트폴리오를 조회함
  const photosQuery = usePhotographerPhotos(contentPhotographerId);

  // 조회한 사진 페이지들을 하나의 목록으로 합침
  const portfolioPhotos =
    photosQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // 첫 번째 응답에서 전체 사진 수를 가져옴
  const portfolioTotalCount = photosQuery.data?.pages[0]?.totalCount ?? 0;

  // 실제 작가 ID로 촬영 상품을 조회함
  const productsQuery = usePhotographerProducts(contentPhotographerId);

  const products = productsQuery.data?.items ?? [];

  // 실제 작가 ID로 리뷰 목록을 조회함
  const reviewsQuery = usePhotographerReviews(
    contentPhotographerId,
    reviewPage,
  );

  // 실제 리뷰 API 응답을 기존 UI 데이터 형태로 변환함
  const reviews: PhotographerReview[] = (reviewsQuery.data?.items ?? []).map(
    (review) => ({
      reviewId: review.reviewId,
      authorName: review.author?.nickname ?? '알 수 없는 사용자',
      createdAt: review.createdAt,
      rating: review.rating,
      comment: review.comment,
      reply: review.reply
        ? {
            createdAt: review.reply.createdAt,
            comment: review.reply.comment,
          }
        : null,
    }),
  );

  // 실제 리뷰 전체 개수를 사용함
  const reviewCount =
    reviewsQuery.data?.totalCount ?? photographer?.reviewCount ?? 0;

  // 서버 기준 필수 항목 완료 개수를 계산함
  const completedReadinessCount = REQUIRED_PROFILE_CHECKS.filter(
    ({ key }) => readinessQuery.data?.checks[key] === true,
  ).length;

  // 서버 응답에 없는 준비 상태 항목이 있는지 확인함
  const hasUnknownReadinessChecks = REQUIRED_PROFILE_CHECKS.some(
    ({ key }) => typeof readinessQuery.data?.checks[key] !== 'boolean',
  );

  // 서버 응답을 기준으로 필수 항목 5개가 모두 완료됐는지 확인함
  const isProfileReady =
    readinessQuery.data?.isReady === true &&
    REQUIRED_PROFILE_CHECKS.every(
      ({ key }) => readinessQuery.data?.checks[key] === true,
    );

  // 저장하지 않은 프로필 편집을 취소하고 기존 화면으로 돌아감
  const handleCancelProfileEdit = () => {
    // 기본 정보 수정 모달 상태를 초기화함
    setIsBasicInfoModalOpen(false);

    // 프로필 편집 모드를 종료함
    setIsEditingProfile(false);
  };

  // 수정 완료 버튼 클릭 시 최신 서버 상태를 다시 확인함
  const handleCompleteProfileEdit = async () => {
    // 서버에서 최신 프로필 준비 상태를 조회함
    const result = await readinessQuery.refetch();

    if (result.isError || !result.data) {
      showToast(
        '프로필 상태를 확인하지 못했어요. 다시 시도해 주세요.',
        'error',
      );
      return;
    }

    // 서버에서 새로운 필수 항목을 제공하는지 확인함
    const hasUnknownChecks = REQUIRED_PROFILE_CHECKS.some(
      ({ key }) => typeof result.data?.checks[key] !== 'boolean',
    );

    if (hasUnknownChecks) {
      showToast('프로필 필수 항목을 입력해 주세요.', 'error');
      return;
    }

    // 아직 완료하지 않은 기본 정보 항목을 가져옴
    const missingItems = REQUIRED_PROFILE_CHECKS.filter(
      ({ key }) => result.data?.checks[key] !== true,
    );

    // 필수 항목이 누락됐다면 편집 모드를 유지함
    if (missingItems.length > 0) {
      const missingLabels = missingItems.map(({ label }) => label).join(', ');

      showToast(`프로필 기본 정보를 설정해 주세요: ${missingLabels}`, 'error');
      return;
    }

    // 서버에서 최종 준비 완료 상태를 확인함
    if (!result.data.isReady) {
      showToast('프로필 준비 상태가 아직 완료되지 않았어요.', 'error');
      return;
    }

    // 모든 필수 항목을 충족한 경우에만 수정 모드를 종료함
    setIsEditingProfile(false);
    showToast('프로필 수정을 완료했어요.');
  };

  // 프로필 조회 중 로딩 상태 표시
  if (isPending) {
    return (
      <PageContainer width="default">
        <p role="status">작가 프로필을 불러오는 중이에요.</p>
      </PageContainer>
    );
  }

  // 프로필 조회 실패 시 오류 표시
  if (isError || !photographer) {
    return (
      <PageContainer width="default">
        <p role="alert">작가 프로필을 불러오지 못했어요.</p>
      </PageContainer>
    );
  }

  // 프로필이 미완성이면서 본인이 아닌 경우 준비 중 화면 표시
  if (!photographer.isReady && !photographer.isSelf) {
    return (
      <PageContainer width="default">
        <PhotographerPreparing onExplore={() => router.push('/')} />
      </PageContainer>
    );
  }

  // 변경된 정책에 따라 기본 정보 5개가 모두 설정되었는지 확인함
  const isBasicInfoComplete =
    Boolean(photographer.profileImageUrl?.trim()) &&
    photographer.regions.length > 0 &&
    photographer.categories.length > 0 &&
    photographer.career !== null &&
    Boolean(photographer.introduction?.trim());

  // API 응답을 기존 기본 정보 컴포넌트의 Props에 맞게 변환함
  const profileInfo = {
    nickname: photographer.nickname,
    profileImageUrl: photographer.profileImageUrl,

    // 저장 대상 작가 ID와 현재 사용자의 저장 여부를 전달함
    photographerId: photographer.id,
    saved: photographer.saved,

    // 촬영 카테고리를 공통 한글 라벨로 변환함
    categories: photographer.categories.map(
      (category) =>
        CategoryLabel[category as keyof typeof CategoryLabel] ?? category,
    ),

    careerLabel:
      photographer.career === null ? null : `경력 ${photographer.career}년`,

    // 활동 지역을 공통 한글 라벨로 변환함
    regions: photographer.regions.map(
      (region) => RegionLabel[region as keyof typeof RegionLabel] ?? region,
    ),

    introduction: photographer.introduction,
    reviewCount: photographer.reviewCount,
    ratingAvg: photographer.ratingAvg,

    // 실제 API 응답에서 저장 수와 구매 확정된 예약 건수를 가져옴
    savedCount: photographer.savedCount,
    completedCount: photographer.completedCount,

    // 작가 본인 여부와 프로필 준비 상태 전달
    isSelf: photographer.isSelf,
    isReady: photographer.isReady,

    // 작가 본인의 프로필 편집 모드 진입을 처리함
    onEditProfile: () => setIsEditingProfile(true),

    // 작가 본인의 편집 모드 상태를 전달함
    isEditingProfile: photographer.isSelf && isEditingProfile,

    // 기본 정보 수정 버튼 클릭 시 모달을 표시함
    onEditBasicInfo: () => setIsBasicInfoModalOpen(true),

    // 로그인 계정 유형을 전달하고 비회원은 null로 처리함
    viewerAccountType: user?.accountType ?? null,
  };

  return (
    <PageContainer width="default">
      {/* 작가 본인의 프로필 편집 상태와 준비 현황을 표시함 */}
      {isEditingProfile && photographer.isSelf && (
        <section className={styles.editPanel} aria-label="프로필 편집">
          <div className={styles.editHeader}>
            <div className={styles.editTitleArea}>
              <h2 className={styles.editTitle}>프로필 수정 중</h2>

              <p className={styles.editDescription}>
                프로필 정보를 수정하고 필수 항목을 확인해 주세요.
              </p>
            </div>

            {/* 프로필 수정 취소 및 완료 버튼을 표시함 */}
            <div className={styles.editAction}>
              <div className={styles.editButtonGroup}>
                {/* 필수 항목 충족 여부와 관계없이 수정 모드를 종료함 */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCancelProfileEdit}
                >
                  수정 취소
                </Button>

                {/* 기본 정보 5개 완료 여부를 확인한 뒤 수정 모드를 종료함 */}
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => void handleCompleteProfileEdit()}
                  disabled={readinessQuery.isFetching}
                >
                  {readinessQuery.isFetching ? '확인 중...' : '수정 완료'}
                </Button>
              </div>
            </div>
          </div>

          {/* 서버에서 조회한 프로필 준비 현황을 표시함 */}
          <div className={styles.readinessSection}>
            <div className={styles.readinessHeader}>
              <h3 className={styles.readinessTitle}>프로필 필수 항목</h3>

              <span
                className={styles.readinessBadge}
                data-ready={isProfileReady}
              >
                {readinessQuery.isPending
                  ? '확인 중'
                  : readinessQuery.isError
                    ? '상태 확인 실패'
                    : isProfileReady
                      ? '준비 완료'
                      : '준비 중'}
              </span>
            </div>

            {readinessQuery.isPending ? (
              <p className={styles.readinessMessage} role="status">
                프로필 준비 상태를 확인하고 있어요.
              </p>
            ) : readinessQuery.isError ? (
              <p className={styles.readinessMessage} role="alert">
                프로필 준비 상태를 불러오지 못했어요.
              </p>
            ) : readinessQuery.isSuccess ? (
              <>
                <p className={styles.readinessMessage}>
                  {isProfileReady
                    ? '필수 항목이 모두 준비되었어요.'
                    : hasUnknownReadinessChecks
                      ? '일부 항목의 완료 여부를 확인할 수 없어요.'
                      : `필수 항목 ${completedReadinessCount}/${REQUIRED_PROFILE_CHECKS.length}개 완료`}
                </p>

                {/* 필수 항목별 완료 여부를 표시함 */}
                <ul className={styles.readinessList}>
                  {REQUIRED_PROFILE_CHECKS.map(({ key, label }) => {
                    const completed = readinessQuery.data.checks[key];

                    const state =
                      completed === true
                        ? 'complete'
                        : completed === false
                          ? 'incomplete'
                          : 'unknown';

                    return (
                      <li
                        key={key}
                        className={styles.readinessItem}
                        data-state={state}
                      >
                        <span aria-hidden="true">
                          {completed === true ? '✓' : '○'}
                        </span>

                        <span>{label}</span>

                        <span className={styles.readinessItemStatus}>
                          {completed === true
                            ? '완료'
                            : completed === false
                              ? '미완료'
                              : '확인 필요'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </div>
        </section>
      )}

      {/* 실제 API로 조회한 작가 기본 정보 표시 */}
      <PhotographerProfileInfo {...profileInfo} />

      {/* 작가 본인이 모달을 열었을 때만 기본 정보 수정 모달을 렌더링함 */}
      {isBasicInfoModalOpen && isEditingProfile && photographer.isSelf && (
        <PhotographerBasicInfoModal
          open
          onClose={() => setIsBasicInfoModalOpen(false)}
          photographer={photographer}
        />
      )}

      {/* 실제 포트폴리오·상품·리뷰 개수 표시 */}
      <PhotographerProfileTabs
        portfolioCount={portfolioTotalCount}
        productCount={products.length}
        reviewCount={reviewCount}
      />

      {/* 실제 포트폴리오 사진 목록 표시 */}
      {photosQuery.isPending ? (
        <p role="status">포트폴리오를 불러오는 중이에요.</p>
      ) : photosQuery.isError && portfolioPhotos.length === 0 ? (
        <p role="alert">포트폴리오를 불러오지 못했어요.</p>
      ) : (
        <PhotographerPortfolio
          photos={portfolioPhotos}
          totalCount={portfolioTotalCount}
          hasNextPage={photosQuery.hasNextPage}
          isFetchingNextPage={photosQuery.isFetchingNextPage}
          onLoadMore={() => void photosQuery.fetchNextPage()}
          isSelf={photographer.isSelf}
          isReady={photographer.isReady}
        />
      )}

      {/* 실제 촬영 상품 목록 표시 */}
      {productsQuery.isPending ? (
        <p role="status">촬영 상품을 불러오는 중이에요.</p>
      ) : productsQuery.isError ? (
        <p role="alert">촬영 상품을 불러오지 못했어요.</p>
      ) : (
        <PhotographerProducts
          products={products}
          isSelf={photographer.isSelf}
          isReady={photographer.isReady}
          isEditing={isEditingProfile && photographer.isSelf}
          isBasicInfoComplete={isBasicInfoComplete}
        />
      )}

      {/* 실제 리뷰 및 작가 답글 목록 표시 */}
      {reviewsQuery.isPending ? (
        <p role="status">리뷰를 불러오는 중이에요.</p>
      ) : reviewsQuery.isError ? (
        <p role="alert">리뷰를 불러오지 못했어요.</p>
      ) : (
        <PhotographerReviews
          reviews={reviews}
          reviewCount={reviewCount}
          ratingAvg={photographer.ratingAvg}
          pagination={{
            currentPage: reviewPage,
            totalPages: reviewsQuery.data?.totalPages ?? 0,
            onPageChange: setReviewPage,
          }}
          isSelf={photographer.isSelf}
          isReady={photographer.isReady}
        />
      )}
    </PageContainer>
  );
}
