'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';
import { queryKeys } from '@/lib/queryKeys';
import { createQuote } from './api';
import { createQuoteInput, type QuoteDraft } from './quote';

export default function useSendQuote(
  roomId: string,
  partnerUserId: string | null,
) {
  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      draft,
      shootingCaseId,
      expectedVersion,
    }: {
      draft: QuoteDraft;
      shootingCaseId?: string;
      expectedVersion?: number;
    }) => {
      if (!partnerUserId) throw new Error('상대방에게 견적을 보낼 수 없어요.');
      // 진행 중 예약의 재견적 제한은 서버가 동일 촬영 건 기준으로 검사합니다.
      return createQuote(
        createQuoteInput(roomId, draft, shootingCaseId, expectedVersion),
        fetchWithAuth,
      );
    },
    // 생성 응답을 놓쳤을 때 자동 재시도하면 별도 촬영 건이나 새 버전이 중복 생성될 수 있습니다.
    retry: false,
    onSuccess: (quote) => {
      client.setQueryData(queryKeys.quotes.detail(quote.id), quote);
      // POST 응답은 견적이므로, 서버 메시지 ID를 임의로 만들지 않고 목록에서 조회합니다.
      void client.invalidateQueries({ queryKey: queryKeys.chats.all });
    },
    onError: (error) => {
      if (error.message === 'API 요청 실패: 409') {
        void client.invalidateQueries({ queryKey: queryKeys.chats.all });
        void client.invalidateQueries({ queryKey: queryKeys.quotes.all });
      }
      const notice =
        error.message === 'API 요청 실패: 409'
          ? '최신 견적 또는 예약 상태가 변경되었어요. 목록을 확인한 뒤 다시 시도해 주세요.'
          : error.message === 'API 요청 실패: 404'
            ? '상품 또는 촬영 건을 찾을 수 없어요. 목록을 다시 확인해 주세요.'
            : error.message === 'API 요청 실패: 403'
              ? '이 문의에 견적을 보낼 권한이 없어요.'
              : error.message === 'API 요청 실패: 422'
                ? '상대방에게 견적을 보낼 수 없어요.'
                : error.message === 'API 요청 실패: 401'
                  ? '로그인이 만료됐어요. 다시 로그인해 주세요.'
                  : error.message === 'API 요청 실패: 400'
                    ? '견적 입력 내용을 확인해 주세요.'
                    : '견적을 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
      showToast(notice, 'error');
    },
  });
  return {
    sendQuote: mutation.mutateAsync,
    isSending: mutation.isPending,
  };
}
