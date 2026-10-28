import Link from 'next/link';
import Image from 'next/image';
import NotificationMenu from './NotificationMenu';
import ProfileMenu from './ProfileMenu';
import styles from './Header.module.css';

export type HeaderUser = {
  id: string;
  nickname: string;
  accountType: 'USER' | 'PHOTOGRAPHER';
  profileImageUrl: string | null;
};

type HeaderProps = {
  user: HeaderUser | null;
  hasUnreadNotifications: boolean;
};

export default function Header({ user, hasUnreadNotifications }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" aria-label="SnapPick 홈" className={styles.logo}>
          <Image src="/logo.svg" alt="" width={107} height={23} />
        </Link>
        <nav aria-label="사용자 메뉴" className={styles.nav}>
          {user ? (
            <>
              <NotificationMenu
                hasUnreadNotifications={hasUnreadNotifications}
              />
              <ProfileMenu user={user} />
            </>
          ) : (
            <Link href="/login" className={styles.loginLink}>
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
