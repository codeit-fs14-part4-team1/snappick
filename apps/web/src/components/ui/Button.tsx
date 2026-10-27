// 기본 HTML 버튼 속성과 아이콘에 사용할 React 타입을 가져옴
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

// 버튼의 디자인 종류를 정의함
type ButtonVariant = 'primary' | 'accent' | 'danger' | 'outline' | 'text';

// 버튼의 크기를 정의함
type ButtonSize = 'sm' | 'md' | 'lg';

// 기본 HTML 버튼 속성에 공통 버튼에서 사용할 Props를 추가함
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  startIcon?: ReactNode;
};

// 전달받은 Props에 따라 버튼의 디자인과 동작을 설정함
export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  startIcon,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  // 버튼 종류, 크기, 너비에 맞는 CSS 클래스를 조합함
  const buttonClassName = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // 기본 버튼 속성을 유지하면서 아이콘과 텍스트를 표시함
  return (
    <button type={type} className={buttonClassName} {...props}>
      {startIcon && (
        <span className={styles.startIcon} aria-hidden="true">
          {startIcon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}
