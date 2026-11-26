'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import ReservationReviewModal from '@/features/reservation/components/ReservationReviewModal';
import { queryKeys } from '@/lib/queryKeys';
import { getEligibleReviews, REVIEW_PAGE_SIZE } from './api';
import type { ReviewBooking } from './types';

const shownAccounts = new Set<string>();

function hasSeenPrompt(key: string) {
  try {
    return localStorage.getItem(key) !== null || shownAccounts.has(key);
  } catch {
    return shownAccounts.has(key);
  }
}

function HomeReviewEditor({
  booking,
  storageKey,
  onClose,
}: {
  booking: ReviewBooking;
  storageKey: string;
  onClose: () => void;
}) {
  const [selectedBooking] = useState(booking);

  useEffect(() => {
    shownAccounts.add(storageKey);
    try {
      localStorage.setItem(storageKey, 'shown');
    } catch {
      // 저장소를 사용할 수 없을 때는 현재 탭에서만 노출 기록을 유지한다.
    }
  }, [storageKey]);

  return <ReservationReviewModal booking={selectedBooking} onClose={onClose} />;
}

function ReviewPromptForAccount({ accountId }: { accountId: string }) {
  const { fetchWithAuth } = useAuth();
  const storageKey = `snappick:home-review-modal:${accountId}`;
  const [dismissed, setDismissed] = useState(() => hasSeenPrompt(storageKey));
  const eligibility = useQuery({
    queryKey: queryKeys.reviews.eligible({
      page: 1,
      pageSize: REVIEW_PAGE_SIZE,
    }),
    queryFn: () => getEligibleReviews(fetchWithAuth, 1),
    enabled: !dismissed,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const booking = eligibility.data?.items[0];
  if (
    dismissed ||
    !eligibility.isSuccess ||
    !eligibility.isFetchedAfterMount ||
    !booking
  ) {
    return null;
  }

  return (
    <HomeReviewEditor
      booking={{
        reservationId: booking.reservationId,
        photographerId: booking.photographer?.photographerId,
        photographerName: booking.photographer?.nickname ?? '작가 정보 없음',
        quoteName: booking.quoteName ?? '',
        shootDate: booking.shootAt,
      }}
      storageKey={storageKey}
      onClose={() => setDismissed(true)}
    />
  );
}

export default function ReviewPrompt() {
  const { authStatus, user } = useAuth();
  if (authStatus !== 'authenticated' || user?.accountType !== 'USER') {
    return null;
  }

  return <ReviewPromptForAccount key={user.id} accountId={user.id} />;
}
