'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import StateMessage from '@/components/ui/StateMessage';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { AuthUser } from '@/features/auth/types';
import styles from './MyPageLayout.module.css';

const userMenuItems = [
  { href: '/my/reservations', label: '예약 내역' },
  { href: '/my/reviews', label: '리뷰 내역' },
  { href: '/my/profile', label: '내 정보' },
];

const MyPageAccountContext = createContext<AuthUser | null>(null);

/** 페이지의 클라이언트 컴포넌트에서 accountType에 따라 콘텐츠 구분 */
export function useMyPageAccount() {
  const account = useContext(MyPageAccountContext);
  if (!account)
    throw new Error('마이페이지 레이아웃 내부에서 사용해야 합니다.');
  return account;
}

/** 메뉴와 제목은 레이아웃에서, 각 기능의 콘텐츠와 데이터는 페이지에서 관리*/
export default function MyPageLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return <MyPageContent user={user}>{children}</MyPageContent>;
}

function MyPageContent({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isPhotographer = user.accountType === 'PHOTOGRAPHER';
  const isReviewPage =
    pathname === '/my/reviews' || pathname.startsWith('/my/reviews/');
  const restricted = isPhotographer && isReviewPage;
  const menuItems = userMenuItems.filter(
    (item) => !isPhotographer || item.href !== '/my/reviews',
  );
  const selectedItem = menuItems.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );

  // 예약 상세에서는 메뉴 선택 상태를 유지하면서 제목만 변경
  const isReservationDetailPage = pathname.startsWith('/my/reservations/');

  const pageTitle = isReservationDetailPage
    ? '예약 상세'
    : (selectedItem?.label ?? '마이페이지');

  useEffect(() => {
    if (restricted) router.replace('/my/reservations');
  }, [restricted, router]);

  if (restricted)
    return (
      <PageContainer>
        <StateMessage
          className={styles.state}
          title="예약 내역으로 이동하고 있어요."
          role="status"
        />
      </PageContainer>
    );

  return (
    <PageContainer className={styles.layout}>
      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarHeading}>마이페이지</h2>
        <nav aria-label="마이페이지 메뉴">
          <ul className={styles.menu}>
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.link}
                  aria-current={selectedItem === item ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <section className={styles.content} aria-labelledby="my-page-title">
        {/* 예약 상세 페이지에서는 자체 제목과 예약번호를 표시 */}
        {!isReservationDetailPage && (
          <h1 id="my-page-title" className={styles.heading}>
            {pageTitle}
          </h1>
        )}

        <MyPageAccountContext.Provider value={user}>
          {children}
        </MyPageAccountContext.Provider>
      </section>
    </PageContainer>
  );
}
