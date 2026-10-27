'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { HeaderUser } from './Header';
import styles from './ProfileMenu.module.css';
import Link from 'next/link';

type ProfileMenuProps = {
  user: HeaderUser;
};

const userMenuItems = [
  { label: 'MY 픽', href: '/my/mypicks' },
  { label: '문의 내역', href: '/my/inquiries' },
  { label: '예약 내역', href: '/my/reservations' },
  { label: '리뷰 내역', href: '/my/reviews' },
  { label: '내 정보', href: '/my/profile' },
];

const photographerMenuItems = [
  { label: '프로필 관리', href: '/photographer/profile' },
  { label: '문의 내역', href: '/photographer/inquiries' },
  { label: '예약 내역', href: '/photographer/reservations' },
  { label: '내 정보', href: '/photographer/my' },
];

export default function ProfileMenu({ user }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuItems =
    user.accountType === 'PHOTOGRAPHER' ? photographerMenuItems : userMenuItems;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (!menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className={styles.profile}>
      <button
        type="button"
        ref={buttonRef}
        aria-label="프로필 메뉴"
        aria-expanded={isOpen}
        aria-controls="profile-menu"
        className={styles.profileButton}
        onClick={() => setIsOpen((open) => !open)}
      >
        {user.profileImageUrl ? (
          <Image
            src={user.profileImageUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className={styles.avatar}
          />
        ) : (
          <span aria-hidden="true" className={styles.avatarPlaceholder}>
            {user.nickname.charAt(0)}
          </span>
        )}
        <span className={styles.nickname}>{user.nickname}</span>
        {user.accountType === 'PHOTOGRAPHER' && (
          <span className={styles.badge}>작가</span>
        )}
        <Image
          src="/arrow.svg"
          alt=""
          width={10}
          height={5}
          className={styles.arrow}
        />
      </button>

      {isOpen && (
        <div id="profile-menu" className={styles.profileMenu}>
          <ul className={styles.menuList}>
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.menuLink}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* // TODO: 인증 API 연결 후 로그아웃 처리 */}
          <button type="button" className={styles.logoutButton}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
