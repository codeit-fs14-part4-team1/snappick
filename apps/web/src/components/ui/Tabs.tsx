'use client';

import { useEffect, useRef } from 'react';
import styles from './Tabs.module.css';

export type TabItem = {
  value: string;
  label: string;
  count?: number;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  'aria-label': string;
  className?: string;
};

function showButton(list: HTMLDivElement, button: HTMLButtonElement) {
  const listBounds = list.getBoundingClientRect();
  const buttonBounds = button.getBoundingClientRect();
  const offset =
    buttonBounds.left < listBounds.left
      ? buttonBounds.left - listBounds.left
      : buttonBounds.right > listBounds.right
        ? buttonBounds.right - listBounds.right
        : 0;

  if (offset !== 0) {
    list.scrollBy({ left: offset, behavior: 'auto' });
  }
}

export default function Tabs({
  items,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  className,
}: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLButtonElement>(
      'button[aria-pressed="true"]',
    );
    if (!list || !selected) return;

    showButton(list, selected);
  }, [value, items]);

  return (
    <div
      ref={listRef}
      className={[styles.list, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={styles.tab}
          aria-pressed={item.value === value}
          onClick={(event) => {
            const list = listRef.current;
            if (list) showButton(list, event.currentTarget);
            if (item.value !== value) {
              onValueChange(item.value);
            }
          }}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={styles.count}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
