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
  hasUnseenNotifications: boolean;
};

export default function Header({ user, hasUnseenNotifications }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" aria-label="SnapPick 홈" className={styles.logo}>
          <Image src="/logo.svg" alt="" width={107} height={23} />
        </Link>
        <nav aria-label="사용자 메뉴" className={styles.nav}>
          {/* 개인정보처리방침: 비회원도 볼 수 있어야 해서 로그인 여부와 관계없이 보여 준다 */}
          <Link
            href="/privacy"
            aria-label="개인정보처리방침"
            title="개인정보처리방침"
            className={styles.infoLink}
          >
            <Image src="/info.svg" alt="" width={24} height={24} />
          </Link>
          {user ? (
            <>
              <NotificationMenu
                key={user.id}
                hasUnseenNotifications={hasUnseenNotifications}
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
