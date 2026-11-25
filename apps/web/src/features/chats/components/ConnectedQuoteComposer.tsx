'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { usePhotographerProfile } from '@/features/profile/hooks/usePhotographerProfile';
import { usePhotographerProducts } from '@/features/profile/hooks/usePhotographerProducts';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { queryKeys } from '@/lib/queryKeys';
import { getQuote } from '../api';
import { toQuoteDraft, type Quote, type QuoteDraft } from '../quote';
import QuoteComposerModal from './QuoteComposerModal';

export default function ConnectedQuoteComposer({
  initialQuote,
  superseded = false,
  onClose,
  onSubmit,
}: {
  initialQuote?: Quote;
  superseded?: boolean;
  onClose: () => void;
  onSubmit: (draft: QuoteDraft) => Promise<void>;
}) {
  const { fetchWithAuth } = useAuth();
  // 로그인 계정 ID와 작가 프로필 ID를 구분해 본인 프로필에서 작가 ID를 조회합니다.
  const profile = usePhotographerProfile(initialQuote ? undefined : 'me');
  const products = usePhotographerProducts(
    initialQuote ? undefined : profile.data?.id,
  );
  const quote = useQuery({
    queryKey: queryKeys.quotes.detail(initialQuote?.id ?? ''),
    queryFn: ({ signal }) => getQuote(initialQuote!.id, fetchWithAuth, signal),
    enabled: Boolean(initialQuote),
    retry: false,
  });
  const failed = initialQuote
    ? quote.isError
    : profile.isError || products.isError;
  const loading = initialQuote
    ? quote.isPending
    : profile.isPending || products.isPending;
  // TODO(결제 API 연동): 견적 상세의 reservationStatus 연결 후 예약 완료 견적의 수정 진입 제한을 검증합니다.
  if (
    quote.data?.reservationStatus &&
    quote.data.reservationStatus !== 'CANCELED'
  ) {
    return (
      <Modal open title="견적 수정" onClose={onClose}>
        <p role="alert">예약이 확정된 견적은 수정할 수 없어요.</p>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </Modal>
    );
  }
  if (initialQuote && (superseded || quote.data?.isLatest === false)) {
    return (
      <Modal open title="견적 수정" onClose={onClose}>
        <p role="alert">
          새 재견적이 발행되었습니다. 최신 견적에서 다시 수정해 주세요.
        </p>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </Modal>
    );
  }
  if (failed || loading)
    return (
      <Modal
        open
        title={initialQuote ? '견적 수정' : '견적 작성'}
        onClose={onClose}
      >
        {failed ? (
          <>
            <p role="alert">견적 작성 정보를 불러오지 못했어요.</p>
            <Button
              variant="outline"
              onClick={() => {
                if (initialQuote) {
                  void quote.refetch();
                } else {
                  void profile.refetch();
                  if (profile.data) void products.refetch();
                }
              }}
            >
              다시 시도
            </Button>
          </>
        ) : (
          <p role="status">
            {initialQuote
              ? '기존 견적 정보를 불러오고 있어요.'
              : '촬영 상품 정보를 불러오고 있어요.'}
          </p>
        )}
      </Modal>
    );
  return (
    <QuoteComposerModal
      open
      onClose={onClose}
      products={(products.data?.items ?? []).map((product) => ({
        ...product,
        id: product.productId,
      }))}
      initialQuote={quote.data ? toQuoteDraft(quote.data) : undefined}
      onSubmit={onSubmit}
    />
  );
}
