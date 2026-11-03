import PageContainer from '@/components/layout/PageContainer';
import FeedView from '@/features/feed/components/FeedView';
import { Suspense } from 'react';

export default function Home() {
  return (
    <PageContainer width="wide">
      <Suspense fallback={<p role="status">사진을 불러오는 중이에요.</p>}>
        <FeedView />
      </Suspense>
    </PageContainer>
  );
}
