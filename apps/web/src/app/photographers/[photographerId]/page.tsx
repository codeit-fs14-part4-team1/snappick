import PageContainer from '@/components/layout/PageContainer';
import PhotographerProfileInfo from '@/features/profile/components/PhotographerProfileInfo';

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

export default async function PhotographerProfilePage({
  params,
}: {
  params: Promise<{ photographerId: string }>;
}) {
  const { photographerId } = await params;
  return (
    // 공통 PageContainer를 사용해 최대 너비 1200px 적용
    <PageContainer width="default">
      {/* 작가 프로필 기본 정보에 임시 데이터 전달 */}
      <PhotographerProfileInfo
        {...mockPhotographer}
        photographerId={photographerId}
      />
    </PageContainer>
  );
}
