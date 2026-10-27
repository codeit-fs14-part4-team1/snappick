'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './NotificationMenu.module.css';

type NotificationMenuProps = {
  hasUnreadNotifications: boolean;
};

export default function NotificationMenu({
  hasUnreadNotifications,
}: NotificationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    <div ref={menuRef} className={styles.notification}>
      <button
        type="button"
        ref={buttonRef}
        aria-label={hasUnreadNotifications ? '알림 (새 알림 있음)' : '알림'}
        aria-expanded={isOpen}
        aria-controls="notification-menu"
        className={styles.notificationButton}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Image src="/bell.svg" alt="" width={24} height={24} />
        {hasUnreadNotifications && (
          <span aria-hidden="true" className={styles.unreadDot} />
        )}
      </button>

      {isOpen && (
        <div
          id="notification-menu"
          aria-labelledby="notification-menu-title"
          className={styles.notificationMenu}
        >
          <p id="notification-menu-title" className={styles.menuTitle}>
            알림
          </p>

          {/* 알림 목록 */}
          <p className={styles.emptyMessage}>새 알람이 없어요</p>
        </div>
      )}
    </div>
  );
}
