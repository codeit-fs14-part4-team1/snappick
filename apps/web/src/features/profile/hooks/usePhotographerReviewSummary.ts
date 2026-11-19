import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getPhotographerReviewSummary } from '../api';

// 특정 사진작가의 AI 리뷰 요약을 조회함
export function usePhotographerReviewSummary(
  photographerId: string | undefined,
) {
  const { authStatus, fetchWithAuth } = useAuth();

  return useQuery({
    // 사진작가별 AI 리뷰 요약 데이터를 별도로 캐싱함
    queryKey: ['photographer-review-summary', photographerId ?? ''],

    // 실제 AI 리뷰 요약 API를 호출함
    queryFn: () => getPhotographerReviewSummary(photographerId!, fetchWithAuth),

    // 인증 초기화가 완료되고 사진작가 ID가 있을 때 조회함
    enabled: authStatus !== 'initializing' && !!photographerId,

    // AI 요약 생성 중에는 10초 간격으로 다시 조회함
    refetchInterval: (query) =>
      query.state.data?.status === 'UPDATING' ? 10_000 : false,

    // 브라우저 탭이 백그라운드에 있을 때는 주기적인 조회를 중단함
    refetchIntervalInBackground: false,
  });
}
