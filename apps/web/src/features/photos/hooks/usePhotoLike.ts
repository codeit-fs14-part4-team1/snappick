//좋아요 클릭 처리: 화면 즉시 반영 + 300ms debounce + 사진당 요청 1개

import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { updatePhotoLike } from '@/features/feed/api';
import type { PhotoLikeResponse } from '@/features/feed/types';
import { useToast } from '@/components/ui/ToastProvider';
import { invalidateLikedPhotos, updatePhotoLikeCache } from '../likeCache';

type UsePhotoLikeParams = { photoId: string; liked: boolean };
const LIKE_DEBOUNCE_MS = 300;

export function usePhotoLike({ photoId, liked }: UsePhotoLikeParams) {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();

  //화면에 쓰지 않는 요청 제어용 기록
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const latestIntentRef = useRef(liked); // 사용자의 최신 의도
  const confirmedRef = useRef(liked); // 서버가 마지막으로 확정한 값

  //요청에 대한 처리 담당
  const { mutate } = useMutation({
    mutationFn: async (nextLiked: boolean): Promise<PhotoLikeResponse> => {
      if (!accessToken) throw new Error('토큰이 없습니다.');
      return await updatePhotoLike(photoId, nextLiked, accessToken);
    },
    onSuccess: (result) => {
      confirmedRef.current = result.liked;
      if (latestIntentRef.current === result.liked)
        updatePhotoLikeCache(
          queryClient,
          result.photoId,
          user ? user.id : null,
          () => ({
            liked: result.liked,
            likeCount: result.likeCount,
          }),
        );
      invalidateLikedPhotos(queryClient);
    },
    onError: () => {
      //확정 상태로 복원
      latestIntentRef.current = confirmedRef.current;
      updatePhotoLikeCache(queryClient, photoId, user ? user.id : null, (p) =>
        p.liked === confirmedRef.current
          ? p
          : {
              liked: confirmedRef.current,
              likeCount: p.likeCount + (confirmedRef.current ? 1 : -1),
            },
      );
      showToast('좋아요를 반영하지 못했어요. 다시 시도해 주세요.', 'error');
    },
    onSettled: () => {
      //실패,성공 모두 실행
      inFlightRef.current = false;
      if (timerRef.current === null) flush();
    },
  });

  //새로운 요청 단위 신호
  function flush() {
    if (inFlightRef.current) return;
    if (latestIntentRef.current === confirmedRef.current) return;
    inFlightRef.current = true;
    mutate(latestIntentRef.current);
  }

  function toggleLike() {
    const next = !latestIntentRef.current;
    latestIntentRef.current = next;
    //임시값으로 캐시변경
    updatePhotoLikeCache(queryClient, photoId, user ? user.id : null, (p) => ({
      liked: next,
      likeCount: p.likeCount + (next ? 1 : -1),
    }));
    //타이머 세팅
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, LIKE_DEBOUNCE_MS);
  }
  //외부에서 바뀐 liked 최신화
  useEffect(() => {
    if (inFlightRef.current || timerRef.current !== null) return;
    latestIntentRef.current = liked;
    confirmedRef.current = liked;
  }, [liked]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 언마운트 시 1회만 실행, flush는 ref만 읽어 안전
  }, []);

  return { toggleLike };
}
