'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from './QuoteActionMenu.module.css';

type Props = {
  disabled: boolean;
  onSelect: () => void;
};

export default function QuoteActionMenu({ disabled, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const action = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => action.current?.focus());
    const closeOnOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={open ? '견적 메뉴 닫기' : '견적 메뉴 열기'}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen((previous) => !previous)}
      >
        {open ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m5 5 14 14M19 5 5 19"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <span className={styles.plus} aria-hidden="true">
            +
          </span>
        )}
      </button>
      {open && (
        <div
          id={id}
          role="group"
          aria-label="견적 메뉴"
          className={styles.popup}
        >
          <button
            ref={action}
            type="button"
            className={styles.action}
            onClick={() => {
              trigger.current?.focus();
              setOpen(false);
              onSelect();
            }}
          >
            <span className={styles.icon} aria-hidden="true">
              ₩
            </span>
            <span className={styles.text}>
              <strong>견적서 만들기</strong>
              <span>상품을 골라 견적을 작성하고 채팅으로 보내요</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
