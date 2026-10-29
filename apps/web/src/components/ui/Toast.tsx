import styles from './Toast.module.css';

// 토스트 메시지의 종류를 정의함
export type ToastVariant = 'success' | 'error';

// 토스트에 전달할 메시지와 종류를 정의함
type ToastProps = {
  message: string;
  variant?: ToastVariant;
};

// 전달받은 메시지와 종류에 따라 토스트를 표시함
export default function Toast({ message, variant = 'success' }: ToastProps) {
  return (
    <div
      className={styles.toast}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      {/* 실패 토스트에만 경고 아이콘을 표시함 */}
      {variant === 'error' && (
        <span className={styles.errorIcon} aria-hidden="true">
          !
        </span>
      )}

      <span className={styles.message}>{message}</span>
    </div>
  );
}
