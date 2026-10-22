import type { ComponentPropsWithoutRef } from 'react';
import styles from './PageContainer.module.css';

type PageContainerProps = ComponentPropsWithoutRef<'div'> & {
  width?: 'default' | 'wide';
};

/** 기본 화면은 1200px, 탐색 화면은 wide(1440px)를 사용합니다. */
export default function PageContainer({
  width = 'default',
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={[styles.container, styles[width], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
