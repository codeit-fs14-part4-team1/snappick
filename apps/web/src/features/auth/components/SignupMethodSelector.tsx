'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthMethodButtons from './AuthMethodButtons';
import type { AccountType } from '@snappick/shared';
import styles from './SignupMethodSelector.module.css';

type SignupMethodSelectorProps = {
  accountType: AccountType;
};

export default function SignupMethodSelector({
  accountType,
}: SignupMethodSelectorProps) {
  const router = useRouter();

  // 선택한 회원 유형을 유지하며 이메일 회원가입 화면으로 이동함
  const handleEmailSignup = () => {
    router.push(`/signup/email?accountType=${accountType}`);
  };

  return (
    <section className={styles.container}>
      <div className={styles.intro}>
        <h1 className={styles.title}>
          원하는 스냅 촬영,
          <br />
          스냅픽에서 시작해요
        </h1>
      </div>

      {/* 회원가입에서는 이메일 버튼을 포함한 네 가지 방법을 표시함 */}
      <AuthMethodButtons
        showEmail
        handlers={{
          email: handleEmailSignup,
        }}
      />

      {/* 기존 회원은 로그인 화면으로 이동함 */}
      <p className={styles.loginPrompt}>
        <span>이미 회원이신가요?</span>

        <Link href="/login" className={styles.loginLink}>
          로그인
        </Link>
      </p>
    </section>
  );
}
