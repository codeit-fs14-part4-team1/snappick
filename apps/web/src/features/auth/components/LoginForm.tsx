'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import AuthMethodButtons from './AuthMethodButtons';
import styles from './LoginForm.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const emailId = useId();
  const passwordId = useId();

  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;

  // 입력값과 각 입력창을 한 번 확인했는지 저장함
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // 입력창에서 다른 곳으로 이동한 뒤부터 오류를 표시함
  const emailError = emailTouched ? getEmailError(email) : '';
  const passwordError =
    passwordTouched && password.length === 0 ? '비밀번호를 입력해 주세요.' : '';

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
        onSubmit={(event) => event.preventDefault()}
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
            onChange={(event) => setEmail(event.currentTarget.value)}
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
            onChange={(event) => setPassword(event.currentTarget.value)}
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

        {/* TODO: 로그인 제출 기능을 연결한 뒤 활성화 조건을 적용함 */}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled>
          로그인
        </Button>
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
