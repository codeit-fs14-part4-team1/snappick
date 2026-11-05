'use client';

import Image from 'next/image';
import Link from 'next/link';

import Button from './Button';
import Modal from './Modal';
import styles from './GuestLoginModal.module.css';
import { useRouter } from 'next/navigation';

type GuestLoginModalProps = {
  open: boolean;
  onClose: () => void;
};

// 시안: 왼쪽 위 X, 로고, 안내 문구, 로그인 버튼, 회원가입 링크
export default function GuestLoginModal({
  open,
  onClose,
}: GuestLoginModalProps) {
  const router = useRouter();

  function handleLoginClick() {
    onClose();
    router.push('/login');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="로그인 안내"
      showTitle={false}
      className={styles.surface}
    >
      <div className={styles.content}>
        <Image
          src="/logo.svg"
          alt="SnapPick"
          width={130}
          height={28}
          className={styles.logo}
        />

        <p className={styles.message}>
          로그인하고 마음에 드는 작가님을 만나보세요
        </p>

        <Button fullWidth size="lg" onClick={handleLoginClick}>
          로그인
        </Button>

        <p className={styles.signup}>
          아직 회원이 아니신가요?{' '}
          <Link href="/signup" onClick={onClose} className={styles.signupLink}>
            회원가입
          </Link>
        </p>
      </div>
    </Modal>
  );
}
