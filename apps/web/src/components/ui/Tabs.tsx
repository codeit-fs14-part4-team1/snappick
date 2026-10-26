'use client';

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

export default function Tabs({
  items,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  className,
}: TabsProps) {
  return (
    <div
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
          onClick={() => {
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
