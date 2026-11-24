import type { Metadata } from 'next';
import ReservationDetail from '@/features/reservation/components/ReservationDetail';

export const metadata: Metadata = { title: '예약 상세 | SnapPick' };

type ReservationDetailPageProps = {
  params: Promise<{ reservationId: string }>;
};

export default async function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const { reservationId } = await params;

  return <ReservationDetail reservationId={reservationId} />;
}
