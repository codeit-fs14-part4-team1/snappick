import PageContainer from '@/components/layout/PageContainer';
import PhotographerProfileInfo from '@/features/profile/components/PhotographerProfileInfo';
import PhotographerProfileTabs from '@/features/profile/components/PhotographerProfileTabs';
import PhotographerPortfolio, {
  type PortfolioPhoto,
} from '@/features/profile/components/PhotographerPortfolio';

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
  // 첫 번째 열
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

  // 두 번째 열
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

  // 세 번째 열
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

  // 네 번째 열
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

export default function PhotographerProfilePage() {
  return (
    // 공통 PageContainer를 사용해 최대 너비 1200px 적용
    <PageContainer width="default">
      {/* 작가 프로필 기본 정보에 임시 데이터 전달 */}
      <PhotographerProfileInfo {...mockPhotographer} />

      {/* 작가 프로필 콘텐츠 탭 표시 */}
      <PhotographerProfileTabs
        portfolioCount={42}
        productCount={3}
        reviewCount={mockPhotographer.reviewCount}
      />

      {/* 작가 포트폴리오 목록에 임시 사진 데이터 전달 */}
      <PhotographerPortfolio photos={mockPortfolioPhotos} totalCount={42} />
    </PageContainer>
  );
}
