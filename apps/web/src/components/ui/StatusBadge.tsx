// HTML span 속성과 배지 텍스트에 사용할 React 타입을 가져옴
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './StatusBadge.module.css';

// 디자인 시안에 있는 상태별 배지 종류를 정의함
type StatusBadgeVariant =
  | 'confirmed'
  | 'shootCompleted'
  | 'delivered'
  | 'purchaseConfirmed'
  | 'canceled'
  | 'cancelRequested';

// 기본 HTML span 속성에 상태 배지에서 사용할 Props를 추가함
type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant: StatusBadgeVariant;
  children: ReactNode;
};

// 전달받은 상태에 따라 배지의 디자인을 설정함
export default function StatusBadge({
  variant,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  // 공통 스타일과 상태별 스타일을 조합함
  const badgeClassName = [styles.badge, styles[variant], className]
    .filter(Boolean)
    .join(' ');

  // 상태에 맞는 스타일로 배지 텍스트를 표시함
  return (
    <span className={badgeClassName} {...props}>
      {children}
    </span>
  );
}
