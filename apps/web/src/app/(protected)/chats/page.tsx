import type { Metadata } from 'next';
import styles from '@/features/chats/components/ChatsLayout.module.css';

export const metadata: Metadata = {
  title: '문의 내역 | SnapPick',
};

export default function ChatsPage() {
  return (
    <section className={styles.empty} aria-label="문의 선택 안내">
      <h2>대화할 문의를 선택해 주세요</h2>
      <p>목록에서 문의를 선택하면 대화를 확인할 수 있어요.</p>
    </section>
  );
}
