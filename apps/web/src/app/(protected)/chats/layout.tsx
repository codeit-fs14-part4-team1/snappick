import { Suspense } from 'react';
import type { ReactNode } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import ConnectedChatsLayout from '@/features/chats/components/ConnectedChatsLayout';
import styles from '@/features/chats/components/ChatsLayout.module.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PageContainer className={styles.page}>
      <Suspense fallback={<p role="status">문의 화면을 준비하고 있어요.</p>}>
        <ConnectedChatsLayout>{children}</ConnectedChatsLayout>
      </Suspense>
    </PageContainer>
  );
}
