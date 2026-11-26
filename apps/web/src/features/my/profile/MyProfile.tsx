'use client';

import Image from 'next/image';
import Button from '@/components/ui/Button';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { startSocialAuth } from '@/features/auth/socialAuth';
import { useMyPageAccount } from '@/features/my/components/MyPageLayout';
import { getMyAccount, updateMyNickname } from './api';
import type { AccountProvider } from './types';
import { ApiError } from '@/lib/api';
import { createPortal } from 'react-dom';
import Toast, { type ToastVariant } from '@/components/ui/Toast';

import PasswordChangeModal from './PasswordChangeModal';
import styles from './MyProfile.module.css';

// 계정 영역에 표시할 로그인 방식 및 아이콘 정의
const ACCOUNT_METHODS: {
  provider: AccountProvider;
  label: string;
  icon: string;
}[] = [
  {
    provider: 'BASIC',
    label: '이메일',
    icon: '/account-email.png',
  },
  {
    provider: 'KAKAO',
    label: '카카오',
    icon: '/account-kakao.png',
  },
  {
    provider: 'NAVER',
    label: '네이버',
    icon: '/account-naver.png',
  },
  {
    provider: 'GOOGLE',
    label: '구글',
    icon: '/account-google.png',
  },
];

type AccountLinkToast = {
  message: string;
  variant: ToastVariant;
};

// 연결 결과와 소셜 서비스에 맞는 토스트 문구를 생성함
function getAccountLinkToast(
  result: string | null,
  provider: string | null,
): AccountLinkToast | null {
  const method = ACCOUNT_METHODS.find(
    (item) => item.provider === provider && item.provider !== 'BASIC',
  );

  if (!method) return null;

  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  switch (result) {
    case 'success':
      return {
        variant: 'success',
        message: isMobile
          ? `${method.label} 계정을 연결했어요.`
          : `${method.label} 계정을 연결했어요. 이제 ${method.label}로도 로그인할 수 있어요.`,
      };

    case 'already-linked':
      return {
        variant: 'error',
        message: `이미 ${method.label} 계정이 연결되어 있어요.`,
      };

    case 'in-use':
      return {
        variant: 'error',
        message: isMobile
          ? `이미 다른 계정에 연결된 ${method.label} 계정이에요.`
          : `이미 다른 스냅픽 계정에 연결된 ${method.label} 계정이에요.`,
      };

    default:
      return null;
  }
}

// 계정 유형에 따라 내 정보 콘텐츠를 구분함
export default function MyProfile() {
  const account = useMyPageAccount();

  return (
    <div className={styles.container}>
      {account.accountType === 'USER' && (
        <NicknameCard
          key={`${account.id}:${account.nickname}`}
          initialNickname={account.nickname}
        />
      )}

      <AccountCard key={account.id} accountId={account.id} />
    </div>
  );
}

// 일반 사용자의 닉네임 조회 및 수정 영역
function NicknameCard({ initialNickname }: { initialNickname: string }) {
  const { fetchWithAuth, refreshUser } = useAuth();
  const { showToast } = useToast();
  const id = useId();

  // 기존 닉네임, 입력값 및 저장 상태를 관리함
  const [savedNickname, setSavedNickname] = useState(initialNickname);
  const [nickname, setNickname] = useState(initialNickname);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 서버에서 반환한 닉네임 중복 오류를 관리함
  const [serverNicknameError, setServerNicknameError] = useState('');

  const savingRef = useRef(false);

  // 앞뒤 공백을 제거한 값을 기준으로 변경 여부와 유효성을 검사함
  const trimmedNickname = nickname.trim();
  const isChanged = trimmedNickname !== savedNickname;
  const isValid = trimmedNickname.length >= 2 && trimmedNickname.length <= 20;

  const validationError =
    isChanged && !isValid ? '닉네임은 2~20자로 입력해 주세요.' : '';

  // 입력값 검증 오류와 서버의 닉네임 중복 오류를 함께 처리함
  const nicknameError = validationError || serverNicknameError;
  const errorMessage = nicknameError || saveError;

  const canSave = isChanged && isValid && !isSaving;

  // 닉네임 수정 및 인증 사용자 정보 갱신
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave || savingRef.current) return;

    savingRef.current = true;
    setIsSaving(true);
    setSaveError('');
    setServerNicknameError('');

    try {
      // 닉네임 수정 API를 호출함
      const response = await updateMyNickname(
        { nickname: trimmedNickname },
        fetchWithAuth,
      );

      setSavedNickname(response.nickname);
      setNickname(response.nickname);

      showToast('닉네임을 변경했어요.');

      // 닉네임 저장 성공과 인증 정보 재조회 실패를 구분함
      try {
        await refreshUser();
      } catch {
        setSaveError(
          '닉네임은 변경되었지만 최신 사용자 정보를 불러오지 못했어요. 새로고침해 주세요.',
        );
      }
    } catch (error) {
      // 닉네임 중복 오류는 입력창의 오류 상태로 처리함
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === 'NICKNAME_ALREADY_EXISTS'
      ) {
        setServerNicknameError('이미 사용 중인 닉네임이에요.');
        return;
      }

      setSaveError('닉네임을 변경하지 못했어요. 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>프로필</h2>

      <form
        className={styles.nicknameForm}
        onSubmit={handleSubmit}
        aria-busy={isSaving}
        noValidate
      >
        <label htmlFor={`${id}-nickname`} className={styles.label}>
          닉네임
        </label>

        <div className={styles.nicknameRow}>
          <input
            id={`${id}-nickname`}
            name="nickname"
            type="text"
            className={styles.nicknameInput}
            value={nickname}
            placeholder="닉네임을 입력해 주세요"
            disabled={isSaving}
            required
            aria-invalid={Boolean(nicknameError)}
            aria-describedby={errorMessage ? `${id}-nickname-error` : undefined}
            onChange={(event) => {
              setNickname(event.target.value);
              setSaveError('');
              setServerNicknameError('');
            }}
          />

          <Button
            type="submit"
            size="lg"
            className={styles.saveButton}
            disabled={!canSave}
          >
            {isSaving ? '저장 중' : '저장'}
          </Button>
        </div>

        {errorMessage && (
          <p id={`${id}-nickname-error`} className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}
      </form>
    </section>
  );
}

// 일반 사용자와 사진작가가 공통으로 사용하는 계정 정보 영역
function AccountCard({ accountId }: { accountId: string }) {
  const [linkToast, setLinkToast] = useState<AccountLinkToast | null>(null);

  // 소셜 인증에서 돌아온 뒤 연결 결과를 한 번만 표시함
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);

      if (
        !url.searchParams.has('linkResult') &&
        !url.searchParams.has('linkProvider')
      ) {
        return;
      }

      const toast = getAccountLinkToast(
        url.searchParams.get('linkResult'),
        url.searchParams.get('linkProvider'),
      );

      // 새로고침했을 때 같은 안내가 다시 나오지 않도록 결과를 제거함
      url.searchParams.delete('linkResult');
      url.searchParams.delete('linkProvider');

      window.history.replaceState(
        null,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );

      if (toast) {
        setLinkToast(toast);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);
  const { fetchWithAuth, authStatus, user } = useAuth();
  const { showToast } = useToast();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // 소셜 계정 연동 진행 상태 및 중복 요청을 관리함
  const [connectingProvider, setConnectingProvider] =
    useState<AccountProvider | null>(null);

  const connectingRef = useRef(false);

  // 현재 로그인 방식과 연결된 계정 정보를 조회함
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['my', 'account', accountId],
    queryFn: () => getMyAccount(fetchWithAuth),
  });

  // 현재 인증 상태 및 계정 정보에 따라 연동 가능 여부를 확인함
  const canConnect =
    authStatus === 'authenticated' &&
    user?.id === accountId &&
    Boolean(data) &&
    !isPending &&
    !isError &&
    !isFetching &&
    !isPasswordModalOpen &&
    connectingProvider === null;

  // 현재 이메일로 로그인한 계정만 비밀번호를 변경할 수 있음
  const canChangePassword =
    data?.provider === 'BASIC' &&
    data.providers.some((item) => item.provider === 'BASIC');

  // 소셜 로그인 상태에서는 이메일 항목을 표시하지 않음
  const visibleAccountMethods =
    data?.provider === 'BASIC'
      ? ACCOUNT_METHODS
      : ACCOUNT_METHODS.filter((method) => method.provider !== 'BASIC');

  // 소셜 인증 화면에서 브라우저 뒤로 가기로 복귀한 경우 요청 상태를 초기화함
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        connectingRef.current = false;
        setConnectingProvider(null);
      }
    }

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // 토스트를 표시한 뒤 3초 후 닫음
  useEffect(() => {
    if (!linkToast) return;

    const timer = window.setTimeout(() => {
      setLinkToast(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [linkToast]);

  // 현재 로그인한 스냅픽 계정에 새로운 소셜 로그인 방식을 연결함
  function handleConnectProvider(provider: AccountProvider) {
    // 이메일 연동 및 인증 진행 중 중복 요청을 차단함
    if (provider === 'BASIC' || !canConnect || connectingRef.current || !data) {
      return;
    }

    // 이미 연결된 로그인 방식은 다시 연동하지 않도록 함
    const isAlreadyConnected =
      data.provider === provider ||
      data.providers.some((item) => item.provider === provider);

    if (isAlreadyConnected) {
      setLinkToast(getAccountLinkToast('already-linked', provider));
      return;
    }

    connectingRef.current = true;
    setConnectingProvider(provider);

    try {
      // 연동을 시작한 계정 정보를 유지하며 소셜 인증 페이지로 이동함
      startSocialAuth(provider, {
        mode: 'link',
        accountId,
      });
    } catch {
      connectingRef.current = false;
      setConnectingProvider(null);

      showToast('소셜 계정 연결을 시작하지 못했어요. 다시 시도해 주세요.');
    }
  }

  return (
    <section className={styles.card}>
      {linkToast &&
        createPortal(
          <div className={styles.accountLinkToast}>
            <Toast message={linkToast.message} variant={linkToast.variant} />
          </div>,
          document.body,
        )}
      <h2 className={styles.cardTitle}>계정</h2>

      {/* 계정 정보 로딩 및 조회 실패 처리 */}
      {isPending ? (
        <p className={styles.stateMessage} role="status">
          계정 정보를 불러오고 있어요.
        </p>
      ) : isError || !data ? (
        <div className={styles.errorState}>
          <p className={styles.stateMessage} role="alert">
            계정 정보를 불러오지 못했어요.
          </p>

          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            다시 시도
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.accountFields}>
            {/* 로그인 방식별 계정 정보 및 연결 상태를 표시함 */}
            <div className={styles.accountField}>
              <span className={styles.accountFieldLabel}>로그인 방식</span>

              <ul className={styles.accountList} aria-label="로그인 방식">
                {visibleAccountMethods.map((method) => {
                  const linkedAccount = data.providers.find(
                    (item) => item.provider === method.provider,
                  );

                  const isConnected = Boolean(linkedAccount);
                  const isCurrent = data.provider === method.provider;

                  const email = isCurrent ? data.email : linkedAccount?.email;

                  return (
                    <li key={method.provider} className={styles.accountRow}>
                      <div className={styles.providerInfo}>
                        <Image
                          src={method.icon}
                          alt=""
                          width={32}
                          height={32}
                          className={styles.providerIcon}
                        />

                        <div className={styles.providerDetails}>
                          <span className={styles.providerName}>
                            {method.label}
                          </span>

                          <p className={styles.providerDescription}>
                            {isConnected
                              ? (email ?? '이메일 정보 없음')
                              : '연결되지 않음'}
                          </p>
                        </div>
                      </div>

                      {/* 현재 로그인 및 계정 연결 상태를 오른쪽에 표시함 */}
                      <div className={styles.providerAction}>
                        {isCurrent ? (
                          <span className={styles.currentBadge}>
                            현재 로그인
                          </span>
                        ) : isConnected ? (
                          <span className={styles.connectedStatus}>연결됨</span>
                        ) : method.provider !== 'BASIC' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className={styles.accountButton}
                            disabled={!canConnect}
                            onClick={() =>
                              handleConnectProvider(method.provider)
                            }
                          >
                            {connectingProvider === method.provider
                              ? '연결 중'
                              : '연결하기'}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 이메일 로그인 계정의 비밀번호 변경 영역 */}
            {canChangePassword && (
              <div className={`${styles.accountField} ${styles.passwordField}`}>
                <span className={styles.accountFieldLabel}>비밀번호</span>

                <Button
                  variant="outline"
                  size="md"
                  className={styles.passwordButton}
                  disabled={connectingProvider !== null}
                  onClick={() => setIsPasswordModalOpen(true)}
                >
                  비밀번호 변경
                </Button>
              </div>
            )}
          </div>

          {canChangePassword && (
            <PasswordChangeModal
              open={isPasswordModalOpen}
              onClose={() => setIsPasswordModalOpen(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
