'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/features/auth/context/AuthContext';
import { apiFetch } from '@/lib/api';
import AuthMethodButtons from './AuthMethodButtons';
import styles from './LoginForm.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginResponse = {
  accessToken: string;
};

// 이메일의 입력 여부와 기본 형식을 확인함
function getEmailError(value: string): string {
  const trimmedEmail = value.trim();

  if (trimmedEmail === '') {
    return '이메일을 입력해 주세요.';
  }

  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return '올바른 이메일 형식이 아니에요.';
  }

  return '';
}

export default function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();

  const emailId = useId();
  const passwordId = useId();

  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;

  // 입력값과 각 입력창을 한 번 확인했는지 저장함
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // 로그인 요청 중 상태와 결과를 관리함
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginStatus, setLoginStatus] = useState<
    'idle' | 'success' | 'invalid' | 'error'
  >('idle');

  // 입력창에서 다른 곳으로 이동한 뒤부터 오류를 표시함
  const emailError = emailTouched ? getEmailError(email) : '';
  const passwordError =
    passwordTouched && password.length === 0 ? '비밀번호를 입력해 주세요.' : '';

  // 이메일 형식이 올바르고 비밀번호가 입력되면 로그인 버튼을 활성화함
  const isLoginFormValid = getEmailError(email) === '' && password.length > 0;

  // 입력값 검증 후 로그인 API를 호출함
  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoginFormValid || isSubmitting || loginStatus === 'success') {
      return;
    }

    setIsSubmitting(true);
    setLoginStatus('idle');

    // 로그인 API 성공 여부와 사용자 정보 조회 실패를 구분함
    let loginApiSucceeded = false;

    try {
      const response = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'BASIC',
          providerEmail: email.trim(),
          password,
        }),
      });

      if (!response?.accessToken) {
        throw new Error('로그인 응답에 Access Token이 없습니다.');
      }

      loginApiSucceeded = true;

      // 토큰 저장과 사용자 정보 조회를 공통으로 처리함
      await login(response.accessToken);

      // 사용자 정보 조회까지 성공하면 로그인 완료로 처리함
      setLoginStatus('success');

      // 로그인 완료 후 메인 페이지로 이동함
      router.replace('/');
    } catch (error) {
      // 로그인 API의 인증 정보 오류만 invalid로 처리함
      if (
        !loginApiSucceeded &&
        error instanceof Error &&
        (error.message === 'API 요청 실패: 400' ||
          error.message === 'API 요청 실패: 401')
      ) {
        setLoginStatus('invalid');
      } else {
        console.error('로그인 요청 실패:', error);
        setLoginStatus('error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={styles.container}>
      <div className={styles.intro}>
        <h1 className={styles.title}>
          <Image
            src="/logo.svg"
            alt="SnapPick 로그인"
            width={107}
            height={23}
            className={styles.logo}
          />
        </h1>

        <p className={styles.description}>
          로그인하고 마음에 드는 작가님을 만나보세요
        </p>
      </div>

      <form
        className={styles.form}
        aria-label="이메일 로그인"
        method="post"
        noValidate
        onSubmit={handleLoginSubmit}
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor={emailId}>
            이메일
          </label>

          <input
            className={styles.input}
            id={emailId}
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.currentTarget.value);
              setLoginStatus('idle');
            }}
            onBlur={() => setEmailTouched(true)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="이메일을 입력해 주세요"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? emailErrorId : undefined}
            required
          />

          {emailError && (
            <p className={styles.errorMessage} id={emailErrorId}>
              {emailError}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={passwordId}>
            비밀번호
          </label>

          <input
            className={styles.input}
            id={passwordId}
            name="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
              setLoginStatus('idle');
            }}
            onBlur={() => setPasswordTouched(true)}
            autoComplete="current-password"
            placeholder="비밀번호를 입력해 주세요"
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? passwordErrorId : undefined}
            required
          />

          {passwordError && (
            <p className={styles.errorMessage} id={passwordErrorId}>
              {passwordError}
            </p>
          )}
        </div>

        {/* 입력값이 유효하면 로그인 버튼을 활성화함 */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={
            !isLoginFormValid || isSubmitting || loginStatus === 'success'
          }
        >
          {isSubmitting ? '로그인 중...' : '로그인'}
        </Button>

        {/* 이메일 또는 비밀번호 불일치 오류를 표시함 */}
        {loginStatus === 'invalid' && (
          <p className={styles.errorMessage} role="alert">
            이메일 또는 비밀번호가 올바르지 않습니다.
          </p>
        )}

        {/* 기타 로그인 오류를 표시함 */}
        {loginStatus === 'error' && (
          <p className={styles.errorMessage} role="alert">
            로그인에 실패했어요. 잠시 후 다시 시도해 주세요.
          </p>
        )}
      </form>
      {/* 이메일 로그인과 소셜 로그인 사이를 구분함 */}
      <div className={styles.divider}>
        <span>또는</span>
      </div>

      {/* 로그인 화면에서는 소셜 로그인 버튼만 표시함 */}
      <AuthMethodButtons />

      {/* 회원가입 화면으로 이동함 */}
      <p className={styles.signupPrompt}>
        <span>아직 회원이 아니신가요?</span>

        <Link href="/signup" className={styles.signupLink}>
          회원가입
        </Link>
      </p>
    </section>
  );
}
