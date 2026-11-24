import type { Metadata } from 'next';
import PageContainer from '@/components/layout/PageContainer';
import styles from './page.module.css';
import MyPickContent from '@/features/mypick/components/MyPickContent';

export const metadata: Metadata = { title: 'MY 픽 | SnapPick' };

export default function MyPickPage() {
  return (
    <PageContainer className={styles.page}>
      <h1 className={styles.title}>MY 픽</h1>
      <MyPickContent />
    </PageContainer>
  );
}
