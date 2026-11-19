'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import PhotographerBasicInfoModal from '@/features/profile/components/PhotographerBasicInfoModal';

import { CategoryLabel, RegionLabel } from '@/constants/enum-labels';
import { useAuth } from '@/features/auth/context/AuthContext';
import { savePhotographerProfileImage } from '@/features/profile/api';

import { usePhotographerProfile } from '@/features/profile/hooks/usePhotographerProfile';
import { usePhotographerPhotos } from '@/features/photos/hooks/usePhotographerPhotos';
import { usePhotographerProducts } from '@/features/profile/hooks/usePhotographerProducts';
import { usePhotographerReviews } from '@/features/profile/hooks/usePhotographerReviews';
import { usePhotographerReviewSummary } from '@/features/profile/hooks/usePhotographerReviewSummary';
import { usePhotographerReadiness } from '@/features/profile/hooks/usePhotographerReadiness';
import { useUpdatePhotographerProfile } from '@/features/profile/hooks/useUpdatePhotographerProfile';
import { useManagePhotographerProducts } from '@/features/profile/hooks/useManagePhotographerProducts';
import { useManagePhotographerReviewReplies } from '@/features/profile/hooks/useManagePhotographerReviewReplies';

import type {
  PhotographerProfile,
  PhotographerProduct,
  UpdatePhotographerProfileInput,
  CreatePhotographerProductInput,
} from '@/features/profile/types';

import PhotographerProfileInfo from '@/features/profile/components/PhotographerProfileInfo';
import PhotographerReviewSummary from '@/features/profile/components/PhotographerReviewSummary';
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

// 편집 시작 시의 값과 서버에 아직 저장하지 않은 값을 분리함
type BasicInfoValues = Pick<
  PhotographerProfile,
  'nickname' | 'career' | 'introduction' | 'regions' | 'categories'
>;

type ProfileEditDraft = {
  originalBasicInfo: BasicInfoValues;
  basicInfo: BasicInfoValues;
  originalProducts: PhotographerProduct[];
  products: PhotographerProduct[];

  // 서버에 저장하지 않은 프로필 이미지 파일을 보관함
  profileImageFile: File | null;

  // 편집 화면에 표시할 이미지 미리보기 URL을 보관함
  profileImagePreviewUrl: string | null;
};

// 배열 참조가 아닌 실제 선택값을 복사함
function pickBasicInfo(profile: PhotographerProfile): BasicInfoValues {
  return {
    nickname: profile.nickname,
    career: profile.career,
    introduction: profile.introduction,
    regions: [...profile.regions],
    categories: [...profile.categories],
  };
}

// 편집을 시작하는 시점의 서버 데이터를 보존함
function createEditDraft(
  profile: PhotographerProfile,
  products: PhotographerProduct[],
): ProfileEditDraft {
  return {
    originalBasicInfo: pickBasicInfo(profile),
    basicInfo: pickBasicInfo(profile),
    originalProducts: products.map((product) => ({ ...product })),
    products: products.map((product) => ({ ...product })),

    // 편집 시작 시 이미지 변경 사항은 없는 상태로 초기화함
    profileImageFile: null,
    profileImagePreviewUrl: null,
  };
}

// 선택 항목은 순서와 관계없이 동일한지 비교함
function sameChoices(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

// 기존 기본 정보와 임시 편집 내용이 달라졌는지 확인함
function sameBasicInfo(a: BasicInfoValues, b: BasicInfoValues) {
  return (
    a.nickname === b.nickname &&
    a.career === b.career &&
    a.introduction === b.introduction &&
    sameChoices(a.regions, b.regions) &&
    sameChoices(a.categories, b.categories)
  );
}

// 화면 데이터에서 실제 상품 API 입력 데이터만 추출함
function toProductInput(
  product: PhotographerProduct,
): CreatePhotographerProductInput {
  return {
    name: product.name,
    price: product.price,
    durationMinutes: product.durationMinutes,
    photoCount: product.photoCount,
    includesOriginal: product.includesOriginal,
    commonNotice: product.commonNotice,
  };
}

// 촬영 상품 필드의 변경 여부를 확인함
function sameProduct(a: PhotographerProduct, b: PhotographerProduct) {
  return (
    JSON.stringify(toProductInput(a)) === JSON.stringify(toProductInput(b))
  );
}

export default function PhotographerProfilePage() {
  const router = useRouter();

  // 현재 로그인한 사용자 정보와 인증 API 및 갱신 함수를 가져옴
  const { user, fetchWithAuth, refreshUser } = useAuth();

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

  // 수정 취소 시 모두 버릴 수 있도록 변경 사항을 서버와 분리해 관리함
  const [editDraft, setEditDraft] = useState<ProfileEditDraft | null>(null);

  // 최종 저장 중에는 중복 저장과 취소 동작을 막음
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 현재 편집 상태에 적용된 이미지 미리보기 URL을 가져옴
  const draftImagePreviewUrl = editDraft?.profileImagePreviewUrl;

  // 미리보기 URL이 변경되거나 더 이상 필요하지 않을 때 해제함
  useEffect(() => {
    if (!draftImagePreviewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(draftImagePreviewUrl);
    };
  }, [draftImagePreviewUrl]);

  // 기존 API 훅은 최종 수정 완료 시에만 사용함
  const updateProfileMutation = useUpdatePhotographerProfile();
  const { saveMutation, deleteMutation } = useManagePhotographerProducts();

  // 리뷰 답글 작성·수정·삭제 Mutation을 가져옴
  const {
    createMutation: createReplyMutation,
    updateMutation: updateReplyMutation,
    deleteMutation: deleteReplyMutation,
  } = useManagePhotographerReviewReplies();

  // 실제 작가 프로필 정보를 조회함
  const {
    data: photographer,
    isPending,
    isError,
    refetch: refetchPhotographer,
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

  // 준비 완료된 프로필의 조회 화면에서만 AI 리뷰 요약을 표시함
  const shouldShowReviewSummary =
    photographer?.isReady === true &&
    !(isEditingProfile && photographer?.isSelf === true);

  // AI 리뷰 요약을 표시하는 경우에만 실제 API를 조회함
  const reviewSummaryQuery = usePhotographerReviewSummary(
    shouldShowReviewSummary ? photographer?.id : undefined,
  );

  // 실제 작가 ID로 포트폴리오를 조회함
  const photosQuery = usePhotographerPhotos(contentPhotographerId);

  // 조회한 사진 페이지들을 하나의 목록으로 합침
  const portfolioPhotos =
    photosQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // 첫 번째 응답에서 전체 사진 수를 가져옴
  const portfolioTotalCount = photosQuery.data?.pages[0]?.totalCount ?? 0;

  // 실제 작가 ID로 촬영 상품을 조회함
  const productsQuery = usePhotographerProducts(contentPhotographerId);
  const serverProducts = productsQuery.data?.items ?? [];

  // 편집 중에는 임시 데이터를, 편집 종료 후에는 서버 데이터를 사용함
  const products = editDraft?.products ?? serverProducts;

  // 편집 중에는 임시 기본 정보와 이미지 미리보기를 화면에 표시함
  const displayedPhotographer: PhotographerProfile | undefined =
    photographer && editDraft
      ? {
          ...photographer,
          ...editDraft.basicInfo,

          // 임시 이미지가 있으면 우선 표시하고 없으면 서버 이미지를 표시함
          profileImageUrl:
            editDraft.profileImagePreviewUrl ?? photographer.profileImageUrl,
        }
      : photographer;

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

  // 편집 중에는 서버 데이터와 임시 변경 사항으로 필수 항목 현황을 표시
  const localChecks = {
    // 기존 서버 이미지 또는 새로 선택한 이미지가 있는지 확인
    profileImage: Boolean(
      photographer?.profileImageUrl?.trim() || editDraft?.profileImageFile,
    ),
    regions: (displayedPhotographer?.regions?.length ?? 0) > 0,
    categories: (displayedPhotographer?.categories?.length ?? 0) > 0,
    career:
      displayedPhotographer?.career !== null &&
      displayedPhotographer?.career !== undefined,
    introduction: Boolean(displayedPhotographer?.introduction?.trim()),
  };

  const missingReadinessLabels = REQUIRED_PROFILE_CHECKS.filter(
    ({ key }) => !localChecks[key],
  ).map(({ label }) => label);

  const isProfileReady = REQUIRED_PROFILE_CHECKS.every(
    ({ key }) => localChecks[key],
  );

  // 서버 데이터를 가져온 뒤에만 변경 전 값을 정확히 보관할 수 있음
  const handleStartProfileEdit = () => {
    if (!photographer?.isSelf || isSavingEdit) return;

    if (!productsQuery.data) {
      showToast('촬영 상품 목록을 확인한 뒤 다시 시도해 주세요.', 'error');
      return;
    }

    setEditDraft(createEditDraft(photographer, productsQuery.data.items));
    setIsEditingProfile(true);
  };

  // 기본 정보 모달에서 적용한 값과 이미지를 임시 상태에만 반영함
  const handleApplyBasicInfo = (
    input: UpdatePhotographerProfileInput,
    imageFile?: File,
  ) => {
    // 편집 상태가 없거나 서버 저장 중이면 임시 변경을 막음
    if (!editDraft || isSavingEdit) {
      return;
    }

    // 새 이미지를 선택한 경우에만 미리보기 URL을 생성함
    const previewUrl = imageFile ? URL.createObjectURL(imageFile) : null;

    setEditDraft((previous) =>
      previous
        ? {
            ...previous,

            // 기존 기본 정보 변경 사항을 유지하며 새 입력값을 반영함
            basicInfo: { ...previous.basicInfo, ...input },

            // 새 이미지가 전달된 경우에만 이미지 변경 사항을 반영함
            ...(imageFile && previewUrl
              ? {
                  profileImageFile: imageFile,
                  profileImagePreviewUrl: previewUrl,
                }
              : {}),
          }
        : previous,
    );
  };

  const handleApplyProduct = (
    productId: string | null,
    input: CreatePhotographerProductInput,
  ) => {
    // 서버 저장 중에는 상품 등록 및 수정 내용을 임시 상태에 반영하지 않음
    if (!editDraft || isSavingEdit) return;

    if (productId === null && (editDraft?.products.length ?? 0) >= 3) {
      showToast('촬영 상품은 최대 3개까지 등록할 수 있어요.', 'error');
      return;
    }

    setEditDraft((previous) => {
      if (!previous) return previous;

      if (productId === null) {
        // 서버 ID와 구별되는 임시 ID를 사용함
        return {
          ...previous,
          products: [
            ...previous.products,
            { productId: `draft-${crypto.randomUUID()}`, ...input },
          ],
        };
      }

      return {
        ...previous,
        products: previous.products.map((product) =>
          product.productId === productId ? { ...product, ...input } : product,
        ),
      };
    });
  };

  // 삭제 버튼도 최종 저장 전에는 API를 호출하지 않음
  const handleDeleteProduct = (productId: string) => {
    // 서버 저장 중에는 상품 삭제를 임시 상태에 반영하지 않음
    if (!editDraft || isSavingEdit) return;

    setEditDraft((previous) =>
      previous
        ? {
            ...previous,
            products: previous.products.filter(
              (product) => product.productId !== productId,
            ),
          }
        : previous,
    );
  };

  // 수정 취소 시 서버 요청 없이 모든 임시 변경 사항을 버림
  const handleCancelProfileEdit = () => {
    if (isSavingEdit) return;
    setIsBasicInfoModalOpen(false);
    setEditDraft(null);
    setIsEditingProfile(false);
    showToast('저장하지 않은 변경 사항을 취소했어요.');
  };

  // 수정 완료 시에만 기존 프로필 및 상품 API를 순서대로 호출함
  const handleCompleteProfileEdit = async () => {
    if (!editDraft || isSavingEdit) return;

    // 기존 필수 항목 5개 정책은 최종 저장 전에 유지함
    if (!isProfileReady) {
      showToast(
        `프로필 기본 정보를 설정해 주세요: ${missingReadinessLabels.join(', ')}`,
        'error',
      );
      return;
    }

    // 원본과 변경 목록을 비교하여 필요한 API 요청만 생성함
    const originalById = new Map(
      editDraft.originalProducts.map((product) => [product.productId, product]),
    );
    const currentById = new Map(
      editDraft.products.map((product) => [product.productId, product]),
    );

    const deletedProducts = editDraft.originalProducts.filter(
      (product) => !currentById.has(product.productId),
    );
    const updatedProducts = editDraft.products.filter((product) => {
      const original = originalById.get(product.productId);
      return original !== undefined && !sameProduct(original, product);
    });
    const newProducts = editDraft.products.filter(
      (product) => !originalById.has(product.productId),
    );

    const isBasicInfoChanged = !sameBasicInfo(
      editDraft.originalBasicInfo,
      editDraft.basicInfo,
    );

    setIsSavingEdit(true);
    let requestedServerChange = false;

    try {
      // 새 프로필 이미지가 있다면 기본 정보와 상품보다 먼저 서버에 저장함
      if (editDraft.profileImageFile) {
        await savePhotographerProfileImage(
          editDraft.profileImageFile,
          fetchWithAuth,
        );

        // 이미지 서버 저장 성공을 기록함
        requestedServerChange = true;

        // Header에도 변경된 프로필 이미지가 반영되도록 사용자 정보를 갱신함
        await refreshUser();
      }

      // 신규 상품 등록이 서버의 기본 정보 완료 검사를 통과하도록 먼저 저장함
      if (isBasicInfoChanged) {
        requestedServerChange = true;
        await updateProfileMutation.mutateAsync({
          nickname: editDraft.basicInfo.nickname,
          ...(editDraft.basicInfo.career !== null
            ? { career: editDraft.basicInfo.career }
            : {}),
          introduction: editDraft.basicInfo.introduction,
          regions: editDraft.basicInfo.regions,
          categories: editDraft.basicInfo.categories,
        });
      }

      // 최대 3개 제한을 유지하기 위해 삭제를 신규 등록보다 먼저 처리함
      for (const product of deletedProducts) {
        requestedServerChange = true;
        await deleteMutation.mutateAsync(product.productId);
      }

      for (const product of updatedProducts) {
        requestedServerChange = true;
        await saveMutation.mutateAsync({
          productId: product.productId,
          input: toProductInput(product),
        });
      }

      for (const product of newProducts) {
        requestedServerChange = true;
        await saveMutation.mutateAsync({ input: toProductInput(product) });
      }

      // 실제 서버 저장을 마친 후 최신 프로필 readiness를 확인함
      const readinessResult = await readinessQuery.refetch();

      // readiness 결과와 관계없이 저장된 최신 프로필 정보를 다시 조회함
      await refetchPhotographer();

      if (readinessResult.isError || !readinessResult.data) {
        // 이미 저장한 변경 사항을 다시 취소할 수는 없으므로 편집을 종료함
        setIsEditingProfile(false);
        setEditDraft(null);
        showToast(
          '변경 사항은 저장했지만 준비 상태를 확인하지 못했어요.',
          'error',
        );
        return;
      }

      if (!readinessResult.data.isReady) {
        // 백엔드 정책과 실제 저장 상태가 다른 경우 오해가 없도록 안내함
        setIsEditingProfile(false);
        setEditDraft(null);
        showToast(
          '변경 사항은 저장했지만 프로필 준비가 완료되지 않았어요.',
          'error',
        );
        return;
      }

      // 서버 저장과 준비 상태 확인이 완료되면 편집 모드를 종료함
      setIsEditingProfile(false);
      setEditDraft(null);
      showToast('프로필 수정을 완료했어요.');
    } catch (error) {
      console.error('프로필 최종 저장 실패:', error);

      if (requestedServerChange) {
        // 여러 개별 API 요청은 트랜잭션이 아니므로 일부 저장됐을 수 있음
        // 실제 서버 데이터를 재조회한 뒤 편집을 종료하여 잘못된 취소를 막음
        await Promise.allSettled([
          refetchPhotographer(),
          productsQuery.refetch(),
          readinessQuery.refetch(),
        ]);
        setIsEditingProfile(false);
        setEditDraft(null);
        showToast(
          '일부 변경 사항이 저장됐을 수 있어요. 화면을 확인해 주세요.',
          'error',
        );
      } else {
        // 서버 변경이 확인되지 않은 경우 오류 내용을 안내하고 편집 상태를 유지함
        showToast(
          error instanceof Error
            ? error.message
            : '프로필을 저장하지 못했어요. 다시 시도해 주세요.',
          'error',
        );
      }
    } finally {
      setIsSavingEdit(false);
    }
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

  // 프로필 조회가 완료된 이후에는 항상 유효한 프로필 값을 사용함
  const activeProfile = displayedPhotographer ?? photographer;

  // 임시 변경 사항까지 포함하여 상품 등록에 필요한 기본 정보 완료 여부를 확인함
  const isBasicInfoComplete =
    Boolean(
      photographer.profileImageUrl?.trim() || editDraft?.profileImageFile,
    ) &&
    activeProfile.regions.length > 0 &&
    activeProfile.categories.length > 0 &&
    activeProfile.career !== null &&
    Boolean(activeProfile.introduction?.trim());
  // API 응답을 기존 기본 정보 컴포넌트의 Props에 맞게 변환함
  const profileInfo = {
    nickname: activeProfile.nickname,
    profileImageUrl: activeProfile.profileImageUrl,

    // 저장 대상 작가 ID와 현재 사용자의 저장 여부를 전달함
    photographerId: photographer.id,
    saved: photographer.saved,

    // 촬영 카테고리를 공통 한글 라벨로 변환함
    categories: activeProfile.categories.map(
      (category) =>
        CategoryLabel[category as keyof typeof CategoryLabel] ?? category,
    ),
    careerLabel:
      activeProfile.career === null ? null : `경력 ${activeProfile.career}년`,

    // 활동 지역을 공통 한글 라벨로 변환함
    regions: activeProfile.regions.map(
      (region) => RegionLabel[region as keyof typeof RegionLabel] ?? region,
    ),
    introduction: activeProfile.introduction,
    reviewCount: photographer.reviewCount,
    ratingAvg: photographer.ratingAvg,

    // 실제 API 응답에서 저장 수와 구매 확정된 예약 건수를 가져옴
    savedCount: photographer.savedCount,
    completedCount: photographer.completedCount,

    // 작가 본인 여부와 프로필 준비 상태 전달
    isSelf: photographer.isSelf,
    isReady: photographer.isReady,

    // 작가 본인의 프로필 편집 모드 진입을 처리함
    onEditProfile: handleStartProfileEdit,

    // 작가 본인의 편집 모드 상태를 전달함
    isEditingProfile: photographer.isSelf && isEditingProfile,

    // 서버 저장 중에는 기본 정보 수정 버튼을 비활성화함
    isSavingEdit,

    // 서버 저장 중에는 기본 정보 수정 모달을 열지 않음
    onEditBasicInfo: () => {
      if (isSavingEdit) return;
      setIsBasicInfoModalOpen(true);
    },

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
              {/* 프로필 수정 제목과 기본 정보 완료 상태를 표시함 */}
              <div className={styles.editTitleRow}>
                <h2 className={styles.editTitle}>프로필 수정 중</h2>
                {/* 기본 정보 완료 여부에 따라 상태 배지 문구를 표시함 */}
                <span
                  className={styles.readinessBadge}
                  data-ready={isProfileReady}
                >
                  {isProfileReady ? '기본 정보 ✓' : '기본 정보 미등록'}
                </span>
              </div>

              {/* 서버의 필수 항목 완료 상태에 따라 안내 문구를 표시함 */}
              <p className={styles.editDescription}>
                {isProfileReady
                  ? '필수 항목을 모두 채웠어요.'
                  : `미완료 항목: ${missingReadinessLabels.join(', ')}. 기본 정보를 설정해 주세요.`}
                {' 변경 사항은 수정 완료를 누르기 전까지 저장되지 않아요.'}
              </p>
            </div>

            {/* 프로필 수정 취소 및 완료 버튼을 표시함 */}
            <div className={styles.editAction}>
              <div className={styles.editButtonGroup}>
                {/* 서버에 저장하지 않은 기본 정보·상품 변경 사항을 버림 */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCancelProfileEdit}
                  disabled={isSavingEdit}
                >
                  수정 취소
                </Button>

                {/* 기본 정보 5개 확인 후 임시 변경 사항을 서버에 저장함 */}
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => void handleCompleteProfileEdit()}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? '저장 중...' : '수정 완료'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 실제 API로 조회한 작가 기본 정보 표시 */}
      <PhotographerProfileInfo {...profileInfo} />

      {/* 준비 완료된 프로필의 조회 화면에 실제 AI 리뷰 요약을 표시함 */}
      {shouldShowReviewSummary && (
        <PhotographerReviewSummary
          data={reviewSummaryQuery.data}
          isPending={reviewSummaryQuery.isPending}
          isError={reviewSummaryQuery.isError}
        />
      )}

      {/* 작가 본인이 모달을 열었을 때만 기본 정보 수정 모달을 렌더링함 */}
      {isBasicInfoModalOpen && isEditingProfile && photographer.isSelf && (
        <PhotographerBasicInfoModal
          open
          onClose={() => setIsBasicInfoModalOpen(false)}
          onApply={handleApplyBasicInfo}
          photographer={activeProfile}
          isSavingEdit={isSavingEdit}
        />
      )}
      {/* 프로필 수정 중에는 콘텐츠 탭을 숨기고 공개 프로필에서만 표시함 */}
      {!(isEditingProfile && photographer.isSelf) && (
        <PhotographerProfileTabs
          portfolioCount={portfolioTotalCount}
          productCount={products.length}
          reviewCount={reviewCount}
        />
      )}

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
          isEditing={isEditingProfile && photographer.isSelf}
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
          isSavingEdit={isSavingEdit}
          isBasicInfoComplete={isBasicInfoComplete}
          onApplyProduct={handleApplyProduct}
          onDeleteProduct={handleDeleteProduct}
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
          onCreateReply={(reviewId, comment) =>
            createReplyMutation.mutateAsync({
              reviewId,
              comment,
            })
          }
          onUpdateReply={(reviewId, comment) =>
            updateReplyMutation.mutateAsync({
              reviewId,
              comment,
            })
          }
          onDeleteReply={(reviewId) =>
            deleteReplyMutation.mutateAsync(reviewId)
          }
        />
      )}
    </PageContainer>
  );
}
