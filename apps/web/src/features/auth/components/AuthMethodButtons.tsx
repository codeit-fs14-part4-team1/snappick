import Image from 'next/image';
import Button from '@/components/ui/Button';
import styles from './AuthMethodButtons.module.css';

// 이메일 버튼 표시 여부와 각 버튼의 클릭 동작을 전달받음
type AuthMethodButtonsProps = {
  showEmail?: boolean;
  disabled?: boolean;
  handlers?: {
    kakao?: () => void;
    naver?: () => void;
    google?: () => void;
    email?: () => void;
  };
};

// 로그인과 회원가입에서 함께 사용할 인증 방법을 정의함
const AUTH_METHODS = [
  {
    id: 'kakao',
    label: '카카오로 시작하기',
    icon: '/kakao.png',
  },
  {
    id: 'naver',
    label: '네이버로 시작하기',
    icon: '/naver.png',
  },
  {
    id: 'google',
    label: 'Google로 시작하기',
    icon: '/google.png',
  },
  {
    id: 'email',
    label: '이메일로 시작하기',
    icon: '/email.png',
  },
] as const;

export default function AuthMethodButtons({
  showEmail = false,
  disabled = false,
  handlers = {},
}: AuthMethodButtonsProps) {
  // showEmail이 true이면 이메일 버튼까지 함께 표시함
  const visibleMethods = AUTH_METHODS.filter(
    (method) => showEmail || method.id !== 'email',
  );

  return (
    <div className={styles.buttons} role="group" aria-label="인증 방법 선택">
      {visibleMethods.map((method) => {
        // 해당 인증 방법에 연결된 클릭 함수를 가져옴
        const handleClick = handlers[method.id];

        return (
          <Button
            key={method.id}
            type="button"
            variant="outline"
            size="lg"
            fullWidth
            className={`${styles.methodButton} ${styles[method.id]}`}
            startIcon={
              <Image
                src={method.icon}
                alt=""
                width={20}
                height={20}
                className={styles.icon}
              />
            }
            onClick={handleClick}
            disabled={disabled || !handleClick}
          >
            {method.label}
          </Button>
        );
      })}
    </div>
  );
}
