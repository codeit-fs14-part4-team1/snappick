'use client';

import { useId, useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { AccountType } from '@snappick/shared';
import styles from './SignupEmailForm.module.css';

type SignupEmailFormProps = {
  accountType: AccountType;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupResponse = {
  accessToken: string;
};

// 회원가입 요청에 사용할 랜덤 닉네임을 생성함
function generateRandomNickname(): string {
  const randomId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  return `스냅픽_${randomId}`;
}

// 이메일 입력 여부와 형식을 확인함
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

// 비밀번호 길이와 영문·숫자·특수문자 포함 여부를 확인함
function getPasswordError(value: string): string {
  if (value.length === 0) {
    return '비밀번호를 입력해 주세요.';
  }

  const hasEnglish = /[A-Za-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecialCharacter = /[^\p{L}\p{N}\s]/u.test(value);

  if (
    value.length < 8 ||
    value.length > 16 ||
    !hasEnglish ||
    !hasNumber ||
    !hasSpecialCharacter
  ) {
    return '비밀번호 입력 조건을 확인해 주세요.';
  }

  return '';
}

// 비밀번호 확인 입력값이 원래 비밀번호와 일치하는지 확인함
function getPasswordConfirmError(
  password: string,
  passwordConfirm: string,
): string {
  if (passwordConfirm.length === 0) {
    return '비밀번호를 다시 입력해 주세요.';
  }

  if (password !== passwordConfirm) {
    return '비밀번호가 일치하지 않아요.';
  }

  return '';
}

export default function SignupEmailForm({ accountType }: SignupEmailFormProps) {
  const { login } = useAuth();

  const emailId = useId();
  const passwordId = useId();

  const passwordConfirmId = useId();
  const passwordHintId = useId();

  const emailErrorId = `${emailId}-error`;
  const passwordConfirmErrorId = `${passwordConfirmId}-error`;

  // 각 입력창의 입력값을 관리함
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // 회원가입 요청 중 상태와 결과를 관리함
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupStatus, setSignupStatus] = useState<
    'idle' | 'success' | 'error' | 'duplicate' | 'sessionError'
  >('idle');

  // 각 입력창을 한 번이라도 벗어났는지 관리함
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordConfirmTouched, setPasswordConfirmTouched] = useState(false);

  // 이메일 형식 오류 또는 중복 이메일 오류를 표시함
  const emailError =
    signupStatus === 'duplicate'
      ? '이미 가입된 이메일입니다.'
      : emailTouched
        ? getEmailError(email)
        : '';

  const passwordError = passwordTouched ? getPasswordError(password) : '';

  // 비밀번호가 모든 입력 조건을 만족하는지 확인함
  const isPasswordValid = getPasswordError(password) === '';

  // 모든 회원가입 입력값이 유효하면 가입하기 버튼을 활성화함
  const isSignupFormValid =
    getEmailError(email) === '' &&
    isPasswordValid &&
    getPasswordConfirmError(password, passwordConfirm) === '';

  const passwordConfirmError = passwordConfirmTouched
    ? getPasswordConfirmError(password, passwordConfirm)
    : '';

  // 입력값 검증 후 랜덤 닉네임을 생성하여 회원가입 API를 호출함
  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !isSignupFormValid ||
      isSubmitting ||
      signupStatus === 'success' ||
      signupStatus === 'sessionError'
    ) {
      return;
    }

    setIsSubmitting(true);
    setSignupStatus('idle');

    // 회원가입 API 성공 여부와 이후 인증 오류를 구분함
    let signupApiSucceeded = false;

    try {
      const response = await apiFetch<SignupResponse>('/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountType: accountType,
          provider: 'BASIC',
          providerEmail: email.trim(),
          password,
          nickname: generateRandomNickname(),
        }),
      });

      signupApiSucceeded = true;

      if (!response?.accessToken) {
        throw new Error('회원가입 응답에 Access Token이 없습니다.');
      }

      // 토큰 저장과 사용자 정보 조회를 공통으로 처리함
      await login(response.accessToken);

      // 사용자 정보 조회까지 성공하면 회원가입 완료로 처리함
      setSignupStatus('success');
    } catch (error) {
      if (signupApiSucceeded) {
        // 가입 후 인증 상태 확인에 실패한 경우
        console.error('회원가입 후 인증 상태 확인 실패:', error);
        setSignupStatus('sessionError');
      } else if (
        error instanceof Error &&
        error.message === 'API 요청 실패: 409'
      ) {
        // 이미 가입된 이메일인 경우
        setSignupStatus('duplicate');
      } else {
        console.error('회원가입 요청 실패:', error);
        setSignupStatus('error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={styles.container} aria-label="이메일 회원가입">
      <form
        className={styles.form}
        method="post"
        noValidate
        onSubmit={handleSignupSubmit}
      >
        {/* 선택한 회원 유형을 회원가입 요청에 사용할 수 있도록 보관함 */}
        <input type="hidden" name="account_type" value={accountType} />

        {/* 이메일 입력 */}
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

              // 이메일을 변경하면 기존 중복 이메일 오류를 초기화함
              if (signupStatus === 'duplicate') {
                setSignupStatus('idle');
              }
            }}
            onBlur={() => setEmailTouched(true)}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="이메일을 입력해 주세요"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? emailErrorId : undefined}
            required
          />

          {emailError && (
            <p className={styles.errorMessage} id={emailErrorId} role="alert">
              {emailError}
            </p>
          )}
        </div>

        {/* 비밀번호 입력 */}
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
            autoComplete="new-password"
            placeholder="비밀번호를 입력해 주세요"
            aria-invalid={Boolean(passwordError)}
            aria-describedby={isPasswordValid ? undefined : passwordHintId}
            required
          />

          {/* 비밀번호 조건을 만족하기 전까지만 안내 문구를 표시함 */}
          {!isPasswordValid && (
            <p
              className={
                passwordError ? styles.errorMessage : styles.helperText
              }
              id={passwordHintId}
            >
              8자 이상, 영문·숫자·특수문자를 포함해 주세요.
            </p>
          )}
        </div>

        {/* 비밀번호 확인 입력 */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor={passwordConfirmId}>
            비밀번호 확인
          </label>

          <input
            className={styles.input}
            id={passwordConfirmId}
            name="passwordConfirm"
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.currentTarget.value)}
            onBlur={() => setPasswordConfirmTouched(true)}
            autoComplete="new-password"
            placeholder="비밀번호를 다시 입력해 주세요"
            aria-invalid={Boolean(passwordConfirmError)}
            aria-describedby={
              passwordConfirmError ? passwordConfirmErrorId : undefined
            }
            required
          />

          {passwordConfirmError && (
            <p
              className={styles.errorMessage}
              id={passwordConfirmErrorId}
              role="alert"
            >
              {passwordConfirmError}
            </p>
          )}
        </div>

        {/* 모든 입력값이 유효하면 가입하기 버튼을 활성화함 */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={
            !isSignupFormValid ||
            isSubmitting ||
            signupStatus === 'success' ||
            signupStatus === 'sessionError'
          }
        >
          {isSubmitting ? '가입 중...' : '가입하기'}
        </Button>

        {/* 기타 회원가입 오류를 표시함 */}
        {signupStatus === 'error' && (
          <p className={styles.errorMessage} role="alert">
            회원가입에 실패했어요. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        {/* 회원가입 후 인증 상태 확인 실패를 안내함 */}
        {signupStatus === 'sessionError' && (
          <p className={styles.errorMessage} role="alert">
            회원가입이 완료되었으나 로그인 후 이용이 가능합니다.
          </p>
        )}
      </form>
    </section>
  );
}
