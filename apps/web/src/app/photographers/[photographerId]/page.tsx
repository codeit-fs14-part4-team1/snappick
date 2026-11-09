import PageContainer from '@/components/layout/PageContainer';
import PhotographerProfileInfo from '@/features/profile/components/PhotographerProfileInfo';
import PhotographerProfileTabs from '@/features/profile/components/PhotographerProfileTabs';

import PhotographerPortfolio, {
  type PortfolioPhoto,
} from '@/features/profile/components/PhotographerPortfolio';

import PhotographerProducts, {
  type PhotographerProduct,
} from '@/features/profile/components/PhotographerProducts';

import PhotographerReviews, {
  type PhotographerReview,
} from '@/features/profile/components/PhotographerReviews';

// 임시 데이터 실제 작가 프로필 API 연동 시 제거 필요
const mockPhotographer = {
  nickname: '하루필름',
  profileImageUrl: null,
  categories: ['우정 스냅', '커플 스냅', '프로필'],
  careerLabel: '경력 7년',
  regions: ['서울', '경기'],
  introduction:
    '안녕하세요, 자연광으로 꾸밈없는 순간을 담는 하루필름입니다. 친구들과의 하루, 연인과의 기념일을 필름 같은 색감으로 기록해드려요. 성수·서울숲·한강 야외 촬영을 주로 하고, 촬영 전 콘셉트 상담을 꼭 진행합니다.',
  reviewCount: 178,
  ratingAvg: 4.9,
  savedCount: 1284,
  completedCount: 334,
};

// 포트폴리오 UI 확인용 임시 사진 데이터 실제 포트폴리오 API 연동 시 제거 필요
const mockPortfolioPhotos: PortfolioPhoto[] = [
  // 커플 사진
  {
    photoId: 'CPL-1-1',
    imageUrl: '/mock/photos/CPL-1-1.webp',
    width: 1448,
    height: 1086,
    displayAspectRatio: '188 / 222',
  },
  {
    photoId: 'CPL-1-2',
    imageUrl: '/mock/photos/CPL-1-2.webp',
    width: 1402,
    height: 1122,
    displayAspectRatio: '188 / 170',
  },
  {
    photoId: 'CPL-1-3',
    imageUrl: '/mock/photos/CPL-1-3.webp',
    width: 1024,
    height: 1536,
    displayAspectRatio: '188 / 195',
  },

  // 가족 사진
  {
    photoId: 'FAM-1-1',
    imageUrl: '/mock/photos/FAM-1-1.webp',
    width: 1402,
    height: 1122,
    displayAspectRatio: '188 / 169',
  },
  {
    photoId: 'FAM-1-2',
    imageUrl: '/mock/photos/FAM-1-2.webp',
    width: 1122,
    height: 1402,
    displayAspectRatio: '188 / 247',
  },
  {
    photoId: 'FAM-1-3',
    imageUrl: '/mock/photos/FAM-1-3.webp',
    width: 1024,
    height: 1536,
    displayAspectRatio: '188 / 156',
  },

  // 반려동물 사진
  {
    photoId: 'PET-1-1',
    imageUrl: '/mock/photos/PET-1-1.webp',
    width: 1122,
    height: 1402,
    displayAspectRatio: '188 / 196',
  },
  {
    photoId: 'PET-1-2',
    imageUrl: '/mock/photos/PET-1-2.webp',
    width: 1024,
    height: 1536,
    displayAspectRatio: '188 / 155',
  },
  {
    photoId: 'PET-1-3',
    imageUrl: '/mock/photos/PET-1-3.webp',
    width: 1086,
    height: 1448,
    displayAspectRatio: '188 / 235',
  },

  // 웨딩 사진
  {
    photoId: 'WED-1-1',
    imageUrl: '/mock/photos/WED-1-1.webp',
    width: 1122,
    height: 1402,
    displayAspectRatio: '188 / 247',
  },
  {
    photoId: 'WED-1-2',
    imageUrl: '/mock/photos/WED-1-2.webp',
    width: 1122,
    height: 1402,
    displayAspectRatio: '188 / 195',
  },
  {
    photoId: 'WED-1-3',
    imageUrl: '/mock/photos/WED-1-3.webp',
    width: 1024,
    height: 1536,
    displayAspectRatio: '188 / 170',
  },
];

// 촬영 상품 UI 확인용 임시 데이터 실제 상품 API 연동 시 제거 필요
const mockProducts: PhotographerProduct[] = [
  {
    productId: 'product-1',
    name: '우정 스냅 베이직',
    price: 150000,
    durationMinutes: 60,
    photoCount: 40,
    includesOriginal: true,
    commonNotice: '2인 기준이며 1인 추가 시 2만 원이 추가돼요.',
  },
  {
    productId: 'product-2',
    name: '우정 스냅 스탠다드',
    price: 220000,
    durationMinutes: 120,
    photoCount: 80,
    includesOriginal: true,
    commonNotice: '장소 2곳까지 이동 촬영해요.',
  },
  {
    productId: 'product-3',
    name: '커플 스냅 프리미엄',
    price: 320000,
    durationMinutes: 180,
    photoCount: 120,
    includesOriginal: true,
    commonNotice: '의상 2벌 촬영, 야간 촬영 포함이에요.',
  },
];

// 리뷰 UI 확인용 임시 데이터 실제 리뷰 API 연동 시 제거 필요
const mockReviews: PhotographerReview[] = [
  {
    reviewId: 'review-1',
    authorName: '소풍가는날',
    createdAt: '2026-10-02T10:00:00+09:00',
    rating: 5,
    comment:
      '사진 찍는 게 어색해서 걱정이었는데 작가님이 편하게 이끌어 주셔서 자연스러운 사진을 많이 건졌어요. 결과물도 약속보다 빨리 받았어요!',
    reply: {
      createdAt: '2026-10-03T10:00:00+09:00',
      comment: '소중한 후기 감사합니다! 다음 촬영 때도 편하게 찾아 주세요 :)',
    },
  },
  {
    reviewId: 'review-2',
    authorName: '민트초코',
    createdAt: '2026-10-02T11:00:00+09:00',
    rating: 5,
    comment:
      '사진 찍는 게 어색해서 걱정이었는데 작가님이 편하게 이끌어 주셔서 자연스러운 사진을 많이 건졌어요. 결과물도 약속보다 빨리 받았어요!',
    reply: null,
  },
  {
    reviewId: 'review-3',
    authorName: '여름사진첩',
    createdAt: '2026-10-02T12:00:00+09:00',
    rating: 5,
    comment:
      '사진 찍는 게 어색해서 걱정이었는데 작가님이 편하게 이끌어 주셔서 자연스러운 사진을 많이 건졌어요. 결과물도 약속보다 빨리 받았어요!',
    reply: {
      createdAt: '2026-10-03T12:00:00+09:00',
      comment: '소중한 후기 감사합니다! 다음 촬영 때도 편하게 찾아 주세요 :)',
    },
  },
];

// 페이지네이션 테스트를 위해 기존 리뷰를 기반으로 임시 데이터 생성
const mockAllReviews: PhotographerReview[] = Array.from(
  { length: mockPhotographer.reviewCount },
  (_, index) => {
    const originalReview = mockReviews[index % mockReviews.length];

    if (!originalReview) {
      throw new Error('리뷰 Mock Data가 없습니다.');
    }

    return {
      ...originalReview,
      reviewId: `review-${index + 1}`,
      authorName:
        index < mockReviews.length
          ? originalReview.authorName
          : `테스트 작성자 ${index + 1}`,
    };
  },
);

export default function PhotographerProfilePage() {
  return (
    // 공통 PageContainer를 사용해 최대 너비 1200px 적용
    <PageContainer width="default">
      {/* 작가 프로필 기본 정보에 임시 데이터 전달 */}
      <PhotographerProfileInfo {...mockPhotographer} />

      {/* 작가 프로필 콘텐츠 탭 표시 */}
      <PhotographerProfileTabs
        portfolioCount={42}
        productCount={mockProducts.length}
        reviewCount={mockPhotographer.reviewCount}
      />

      {/* 작가 포트폴리오 목록에 임시 사진 데이터 전달 */}
      <PhotographerPortfolio photos={mockPortfolioPhotos} totalCount={42} />

      {/* 작가 촬영 상품 목록에 임시 데이터 전달 */}
      <PhotographerProducts products={mockProducts} />

      {/* 페이지네이션 테스트용 리뷰 데이터 전달 */}
      <PhotographerReviews
        reviews={mockAllReviews}
        reviewCount={mockPhotographer.reviewCount}
        ratingAvg={mockPhotographer.ratingAvg}
      />
    </PageContainer>
  );
}
