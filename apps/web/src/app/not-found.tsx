import type { Metadata } from 'next';
import PageContainer from '@/components/layout/PageContainer';
import StateMessage from '@/components/ui/StateMessage';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요 | SnapPick',
};

// 없는 주소와 notFound()를 호출한 화면에서 공통으로 보여 줍니다.
export default function NotFound() {
  return (
    <PageContainer>
      <StateMessage
        className={styles.state}
        role="alert"
        title="페이지를 찾을 수 없어요"
        description="주소가 잘못됐거나 볼 수 없는 페이지예요."
        link={{ label: '메인으로', href: '/' }}
      />
    </PageContainer>
  );
}
