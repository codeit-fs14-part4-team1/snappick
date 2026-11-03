import PageContainer from '@/components/layout/PageContainer';
import FeedView from '@/features/feed/components/FeedView';

export default function Home() {
  return (
    <PageContainer width="wide">
      <FeedView />
    </PageContainer>
  );
}
