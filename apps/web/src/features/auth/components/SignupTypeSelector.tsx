'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AccountType } from '@snappick/shared';
import Button from '@/components/ui/Button';
import styles from './SignupTypeSelector.module.css';

const ACCOUNT_TYPES: {
  value: AccountType;
  title: string;
  description: string;
}[] = [
  {
    value: 'USER',
    title: '일반 회원',
    description: '사진을 둘러보고 작가님께 촬영을 문의해요',
  },
  {
    value: 'PHOTOGRAPHER',
    title: '작가 회원',
    description: '포트폴리오를 올리고 촬영 문의를 받아요',
  },
];

export default function SignupTypeSelector() {
  const router = useRouter();

  // 처음은 일반 회원을 기본으로 선택함
  const [accountType, setAccountType] = useState<AccountType>('USER');

  // 선택한 회원 유형을 다음 가입 화면에 전달함
  const handleNext = () => {
    router.push(`/signup/method?accountType=${accountType}`);
  };

  return (
    <section className={styles.container}>
      <div className={styles.intro}>
        <h1 className={styles.title}>어떤 회원으로 가입할까요?</h1>
        <p className={styles.description}>스냅픽을 이용할 방법을 골라 주세요</p>
      </div>

      <fieldset className={styles.options}>
        <legend className={styles.srOnly}>회원 유형 선택</legend>

        {ACCOUNT_TYPES.map((option) => {
          const isSelected = accountType === option.value;

          return (
            <label
              key={option.value}
              className={[styles.option, isSelected && styles.selected]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                name="accountType"
                value={option.value}
                checked={isSelected}
                onChange={() => setAccountType(option.value)}
                className={styles.radioInput}
              />

              <span className={styles.optionText}>
                <strong className={styles.optionTitle}>{option.title}</strong>
                <span className={styles.optionDescription}>
                  {option.description}
                </span>
              </span>

              <span className={styles.checkIcon} aria-hidden="true">
                {isSelected ? '✓' : ''}
              </span>
            </label>
          );
        })}
      </fieldset>

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleNext}
      >
        다음
      </Button>

      <p className={styles.loginPrompt}>
        <span>이미 회원이신가요?</span>
        <Link href="/login" className={styles.loginLink}>
          로그인
        </Link>
      </p>
    </section>
  );
}
