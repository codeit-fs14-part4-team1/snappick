import PageContainer from '@/components/layout/PageContainer';
import StateMessage from './StateMessage';
import styles from './AccessDenied.module.css';

/**
 * 접근 권한이 없는 화면을 열었을 때 주소는 그대로 두고 내용만 교체합니다.
 * 403에는 업로드 만료처럼 권한과 무관한 것도 있어, 화면을 여는 요청에만 사용합니다.
 */
export default function AccessDenied() {
  return (
    <PageContainer>
      <StateMessage
        className={styles.state}
        role="alert"
        title="접근 권한이 없어요"
        description="로그인한 계정으로는 볼 수 없는 페이지예요."
        link={{ label: '메인으로', href: '/' }}
      />
    </PageContainer>
  );
}
