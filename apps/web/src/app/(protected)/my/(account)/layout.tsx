import type { ReactNode } from 'react';
import MyPageLayout from '@/features/my/components/MyPageLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <MyPageLayout>{children}</MyPageLayout>;
}
