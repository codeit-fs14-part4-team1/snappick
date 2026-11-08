'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useColumnCount } from '@/hooks/useColumnCount';
import { distributeToColumns } from '@/lib/masonry';
import styles from './Masonry.module.css';

//숫자: 모든 화면 같은 간격 / 객체: 없는 값은 큰 화면 값을 이어받음 (tablet ← desktop, mobile ← tablet)
type MasonryGap =
  number | { desktop: number; tablet?: number; mobile?: number };

type MasonryProps<T extends { width: number; height: number }> = {
  items: T[];
  desktopColumns: number;
  ariaLabel: string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  gap: MasonryGap;
};

function toGapValues(gap: MasonryGap): {
  desktop: number;
  tablet: number;
  mobile: number;
} {
  if (typeof gap === 'number')
    return { desktop: gap, tablet: gap, mobile: gap };
  const tablet = gap.tablet ?? gap.desktop;
  const mobile = gap.mobile ?? tablet;
  return { desktop: gap.desktop, tablet, mobile };
}

export default function Masonry<T extends { width: number; height: number }>({
  items,
  desktopColumns,
  gap,
  ariaLabel,
  getKey,
  renderItem,
}: MasonryProps<T>) {
  const columnCount = useColumnCount(desktopColumns);
  if (columnCount === null) return null;
  const columns = distributeToColumns(items, columnCount);

  const { desktop, tablet, mobile } = toGapValues(gap);
  const gapStyle = {
    '--gap-desktop': `${desktop}px`,
    '--gap-tablet': `${tablet}px`,
    '--gap-mobile': `${mobile}px`,
  } as CSSProperties;

  return (
    <div
      className={styles.masonry}
      style={gapStyle}
      role="list"
      aria-label={ariaLabel}
    >
      {columns.map((column, index) => (
        <div key={index} className={styles.column} role="presentation">
          {column.map((item) => (
            <div key={getKey(item)} role="listitem">
              {renderItem(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
