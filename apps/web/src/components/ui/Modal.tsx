'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './Modal.module.css';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** 본문형은 기본값, 제목·설명·버튼만 있는 확인창은 confirm 사용 */
  variant?: 'default' | 'confirm';
  /** 제목을 숨겨도 화면 낭독기를 위한 모달 이름은 유지 */
  showTitle?: boolean;
  closeButtonPosition?: 'inside' | 'outside';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
};

// 배경 페이지 스크롤 잠금 기능
let scrollLockCount = 0;
let previousOverflow = '';
let previousOverflowPriority = '';

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    previousOverflow = document.body.style.getPropertyValue('overflow');
    previousOverflowPriority =
      document.body.style.getPropertyPriority('overflow');
    document.body.style.setProperty('overflow', 'hidden');
  }
  scrollLockCount += 1;

  return () => {
    scrollLockCount -= 1;
    if (scrollLockCount === 0) {
      if (previousOverflow) {
        document.body.style.setProperty(
          'overflow',
          previousOverflow,
          previousOverflowPriority,
        );
      } else {
        document.body.style.removeProperty('overflow');
      }
    }
  };
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'default',
  showTitle = true,
  closeButtonPosition = 'inside',
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
}: ModalProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pointerStartedOnBackdrop = useRef(false);
  const isCloseOutside = closeButtonPosition === 'outside';

  const titleElement = (
    <h2
      id={`${id}-title`}
      ref={titleRef}
      tabIndex={-1}
      className={[styles.title, !showTitle && styles.visuallyHidden]
        .filter(Boolean)
        .join(' ')}
    >
      {title}
    </h2>
  );

  const closeButton = (
    <button
      type="button"
      className={[styles.closeButton, isCloseOutside && styles.outsideClose]
        .filter(Boolean)
        .join(' ')}
      aria-label="모달 닫기"
      onClick={onClose}
    >
      <span aria-hidden="true">×</span>
    </button>
  );

  // 모달 열기 믿 닫기 시 포커스 관리 및 스크롤 잠금
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const previousFocus = document.activeElement;
    dialog.showModal();
    const unlockScroll = lockBodyScroll();
    titleRef.current?.focus({ preventScroll: true });

    return () => {
      if (dialog.open) dialog.close();
      unlockScroll();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return (
    //모달 접근성 이름
    <dialog
      ref={dialogRef}
      className={[styles.dialog, isCloseOutside && styles.outsideDialog]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      // Tab키 포커스 내부 순환
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || event.defaultPrevented) return;

        const elements = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button, a[href], input, select, textarea, [tabindex]',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            element.getClientRects().length > 0 &&
            !element.closest('[inert]'),
        );
        const first = elements[0];
        const last = elements[elements.length - 1];

        if (!first) {
          event.preventDefault();
          titleRef.current?.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === titleRef.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      // ESC 키로 모달 닫기
      onCancel={(event) => {
        event.preventDefault();
        if (closeOnEscape) onClose();
      }}
      onClose={(event) => {
        // form method="dialog" 등 브라우저에서 닫힌 경우도 부모 컴포넌트에 onClose를 전달
        if (
          event.target === event.currentTarget &&
          !event.currentTarget.open &&
          open
        ) {
          onClose();
        }
      }}
      // 배경 클릭으로 모달 닫기
      onPointerDown={(event) => {
        pointerStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        pointerStartedOnBackdrop.current =
          pointerStartedOnBackdrop.current &&
          document.elementFromPoint(event.clientX, event.clientY) ===
            event.currentTarget;
      }}
      onPointerCancel={() => {
        pointerStartedOnBackdrop.current = false;
      }}
      onClick={(event) => {
        if (
          closeOnBackdrop &&
          pointerStartedOnBackdrop.current &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
        pointerStartedOnBackdrop.current = false;
      }}
    >
      {open && (
        // 모달 콘텐츠 랜더링
        <div
          className={[
            styles.surface,
            variant === 'confirm' && styles.confirm,
            isCloseOutside && styles.outsideSurface,
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {showTitle || !isCloseOutside ? (
            <header className={styles.header}>
              {titleElement}
              {!isCloseOutside && closeButton}
            </header>
          ) : (
            titleElement
          )}
          {isCloseOutside && closeButton}
          <div className={styles.body}>
            {description && (
              <p id={`${id}-description`} className={styles.description}>
                {description}
              </p>
            )}
            {children}
          </div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
