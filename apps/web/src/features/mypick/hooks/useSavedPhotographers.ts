import { queryKeys } from '@/lib/queryKeys';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getSavedPhotographers } from '../api';

const SAVED_PHOTOGRAPHERS_LIMIT = 12;

//MY 픽 저장한 작가 무한 조회
export function useSavedPhotographers(options: { limit?: number } = {}) {
  const { fetchWithAuth } = useAuth();
  const { limit = SAVED_PHOTOGRAPHERS_LIMIT } = options;

  return useInfiniteQuery({
    queryKey: queryKeys.photographers.saved(limit),
    queryFn: ({ pageParam }) =>
      getSavedPhotographers({ cursor: pageParam, limit }, fetchWithAuth),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
