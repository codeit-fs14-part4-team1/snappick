import type { Metadata } from 'next';
import MyReviews from '@/features/my/reviews/MyReviews';

export const metadata: Metadata = { title: '리뷰 내역 | SnapPick' };

export default function ReviewsPage() {
  return <MyReviews />;
}
