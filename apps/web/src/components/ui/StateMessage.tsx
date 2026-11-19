import Link from 'next/link';
import Button from './Button';
import styles from './StateMessage.module.css';

type StateMessageProps = {
  /** 빈 목록·조회 실패·로그인 필요 등 상태를 설명하는 제목 */
  title: string;
  /** 제목 아래 설명. 생략하면 설명 영역을 표시하지 않습니다. */
  description?: string;
  /** 페이지별 높이·여백 등 추가 스타일. 기본 높이는 고정하지 않습니다. */
  className?: string;
  /** 화면 낭독기 안내: 동적 오류는 alert, 진행 안내는 status. 일반 빈 목록은 생략 가능 */
  role?: 'status' | 'alert';
} & (
  | {
      /** 재시도 등 현재 화면에서 실행할 동작. 기존 공통 Button 사용 */
      button?: { label: string; onClick: () => void; disabled?: boolean };
      // 버튼과 링크는 함께 전달할 수 없으며, 둘 다 생략할 수 있습니다.
      link?: never;
    }
  | {
      button?: never;
      /** 로그인 등 페이지 이동. 링크 스타일은 StateMessage 내부에서 관리 */
      link: { label: string; href: string };
    }
);

/**
 * 상태 안내의 문구와 액션을 표시합니다.
 * 상태 판단·API 요청·인증 처리는 사용하는 페이지에서 관리합니다.
 * onClick을 전달하는 페이지는 클라이언트 컴포넌트여야 합니다.
 */
export default function StateMessage({
  title,
  description,
  button,
  link,
  className,
  role,
}: StateMessageProps) {
  return (
    <div
      className={[styles.container, className].filter(Boolean).join(' ')}
      role={role}
    >
      <div className={styles.message}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {/* 액션이 없으면 버튼 영역과 해당 영역의 간격도 만들지 않습니다. */}
      {(button || link) && (
        <div className={styles.action}>
          {button && (
            <Button
              variant="outline"
              onClick={button.onClick}
              disabled={button.disabled}
            >
              {button.label}
            </Button>
          )}
          {link && (
            <Link href={link.href} className={styles.link}>
              {link.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
