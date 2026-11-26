'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import StateMessage from '@/components/ui/StateMessage';

import { useAuth } from '@/features/auth/context/AuthContext';
import { linkSocialProvider } from '@/features/my/profile/api';
import { ApiError } from '@/lib/api';

import { socialLogin, socialSignup } from '../api';
import { takeReturnPath } from '../returnPath';
import { consumeSocialAuth } from '../socialAuth';
import type {
  SocialAuthIntent,
  SocialAuthResponse,
  SocialLinkIntent,
  SocialLoginInput,
} from '../types';

// 소셜 회원가입, 로그인 및 계정 연동 목적을 통합함
type CallbackIntent = SocialAuthIntent | SocialLinkIntent;

type PendingSocialAuth = ReturnType<typeof consumeSocialAuth>;

type CallbackAuth = Pick<
  ReturnType<typeof useAuth>,
  'login' | 'authStatus' | 'user' | 'fetchWithAuth'
>;

// 소셜 인증 실패 시 이동할 화면 및 결과 타입 정의
type RetryTarget = {
  href: string;
  label: string;
};

type CallbackFailure = {
  status: 'error';
  message: string;
  target: RetryTarget;
  presentation: 'page' | 'toast';
};

type CallbackSuccess = {
  status: 'success';
  href: string;
  linkedAccountId?: string;
};

type CallbackResult =
  CallbackSuccess | { status: 'cancelled' } | CallbackFailure;

// 검증된 소셜 인증 요청 정보를 관리함
type PreparedCallback =
  | {
      status: 'ready';
      pendingAuth: PendingSocialAuth;
      input: SocialLoginInput;
    }
  | CallbackFailure;

const LOGIN_TARGET: RetryTarget = {
  href: '/login',
  label: '로그인으로 돌아가기',
};

const PROFILE_TARGET: RetryTarget = {
  href: '/my/profile',
  label: '내 정보로 돌아가기',
};

// 소셜 계정 연결 결과를 내 정보 화면으로 전달함
function getLinkResultHref(
  result: 'success' | 'already-linked' | 'in-use',
  provider: PendingSocialAuth['provider'],
): string {
  const params = new URLSearchParams({
    linkResult: result,
    linkProvider: provider,
  });

  return `${PROFILE_TARGET.href}?${params.toString()}`;
}

// 인증 목적에 따라 재시도할 화면을 결정함
function getRetryTarget(intent: CallbackIntent): RetryTarget {
  if (intent.mode === 'signup') {
    return {
      href: `/signup/method?accountType=${intent.accountType}`,
      label: '회원가입으로 돌아가기',
    };
  }

  if (intent.mode === 'link') {
    return PROFILE_TARGET;
  }

  return LOGIN_TARGET;
}

// 오류 안내 문구와 이동 경로 및 표시 방식을 정의함
function createFailure(
  message: string,
  target: RetryTarget = LOGIN_TARGET,
  presentation: 'page' | 'toast' = 'page',
): CallbackFailure {
  return {
    status: 'error',
    message,
    target,
    presentation,
  };
}

// API 오류 응답에 따라 안내 문구 및 이동 경로를 구분함
function getRequestFailure(
  error: unknown,
  intent: PendingSocialAuth,
): CallbackFailure {
  const message = error instanceof Error ? error.message : '';
  const code = error instanceof ApiError ? error.code : undefined;
  const target = getRetryTarget(intent);

  // 소셜 계정 연동 시 발생하는 상세 오류를 처리함
  if (intent.mode === 'link') {
    switch (code) {
      case 'PROVIDER_ALREADY_LINKED':
        return createFailure(
          '이미 연결된 로그인 방식이에요.',
          {
            ...PROFILE_TARGET,
            href: getLinkResultHref('already-linked', intent.provider),
          },
          'toast',
        );

      case 'SOCIAL_ACCOUNT_IN_USE':
        return createFailure(
          '다른 계정에서 사용 중인 소셜 계정이에요.',
          {
            ...PROFILE_TARGET,
            href: getLinkResultHref('in-use', intent.provider),
          },
          'toast',
        );

      case 'SOCIAL_EMAIL_REQUIRED':
        return createFailure(
          '계정을 연결하려면 이메일 제공에 동의해 주세요.',
          target,
        );

      case 'SOCIAL_EMAIL_NOT_VERIFIED':
        return createFailure(
          '인증된 이메일이 있는 계정만 연결할 수 있어요.',
          target,
        );

      case 'INVALID_SOCIAL_AUTH':
        return createFailure(
          '소셜 인증에 실패했어요. 다시 시도해 주세요.',
          target,
        );
    }

    if (message === 'API 요청 실패: 400') {
      return createFailure(
        '소셜 계정을 연결하지 못했어요. 인증 정보를 확인해 주세요.',
        target,
      );
    }

    if (message === 'API 요청 실패: 401') {
      return createFailure(
        '로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.',
        LOGIN_TARGET,
      );
    }

    if (message === 'API 요청 실패: 409') {
      return createFailure('소셜 계정의 연결 상태를 확인해 주세요.', target);
    }
  }

  // 가입되지 않은 소셜 계정은 회원가입 화면으로 안내함
  if (intent.mode === 'login' && message === 'API 요청 실패: 404') {
    return createFailure(
      '가입되지 않은 계정이에요. 회원가입을 진행해 주세요.',
      {
        href: '/signup',
        label: '회원가입',
      },
    );
  }

  // 이미 가입된 계정은 기존 로그인 방식으로 안내함
  if (intent.mode === 'signup' && message === 'API 요청 실패: 409') {
    return createFailure(
      '이미 가입된 계정이에요. 기존 계정으로 로그인해 주세요.',
    );
  }

  if (message === 'API 요청 실패: 400') {
    return createFailure(
      intent.mode === 'signup'
        ? '회원가입을 완료하지 못했어요. 이메일 제공 동의 여부 등을 확인해 주세요.'
        : '소셜 로그인 요청을 처리하지 못했어요. 다시 시도해 주세요.',
      target,
    );
  }

  if (message === 'API 요청 실패: 401') {
    return createFailure('소셜 인증에 실패했어요. 다시 시도해 주세요.', target);
  }

  if (message === 'API 요청 실패: 502') {
    return createFailure(
      '소셜 로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      target,
    );
  }

  if (message === 'API 요청 실패: 503') {
    return createFailure('소셜 로그인 설정을 확인해 주세요.', target);
  }

  return createFailure(
    '소셜 인증을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
    target,
  );
}

// 콜백 주소와 인증 요청 정보를 검증하고 API 요청값을 준비함
function prepareSocialAuth(): PreparedCallback {
  const searchParams = new URLSearchParams(window.location.search);

  // 인가 코드와 state가 주소창에 불필요하게 남지 않도록 제거함
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname,
  );

  const state = searchParams.get('state');

  if (!state || searchParams.getAll('state').length !== 1) {
    return createFailure(
      '소셜 인증 요청 정보가 올바르지 않아요. 다시 시도해 주세요.',
    );
  }

  let pendingAuth: PendingSocialAuth;

  // 최초 인증 요청과 콜백의 state 및 주소를 검증함
  try {
    pendingAuth = consumeSocialAuth(state);
  } catch {
    return createFailure(
      '소셜 인증 요청이 만료되었거나 올바르지 않아요. 다시 시도해 주세요.',
    );
  }

  const target = getRetryTarget(pendingAuth);

  // 소셜 인증 취소 및 제공자 오류를 처리함
  if (searchParams.has('error')) {
    return createFailure(
      searchParams.get('error') === 'access_denied'
        ? '소셜 인증이 취소되었어요.'
        : '소셜 인증을 완료하지 못했어요.',
      target,
    );
  }

  const code = searchParams.get('code');

  if (!code || searchParams.getAll('code').length !== 1) {
    return createFailure(
      '소셜 인증 정보를 받지 못했어요. 다시 시도해 주세요.',
      target,
    );
  }

  const input: SocialLoginInput = {
    provider: pendingAuth.provider,
    code,
    redirectUri: pendingAuth.redirectUri,
    state: pendingAuth.state,
  };

  return {
    status: 'ready',
    pendingAuth,
    input,
  };
}

// 인증 목적에 따라 회원가입, 로그인 또는 계정 연동 요청을 처리함
async function completeSocialAuth(
  callback: PreparedCallback,
  auth: CallbackAuth,
  isActive: () => boolean,
): Promise<CallbackResult> {
  if (!isActive()) {
    return { status: 'cancelled' };
  }

  if (callback.status === 'error') {
    return callback;
  }

  const { pendingAuth, input } = callback;

  // 기존 로그인 세션을 유지하면서 소셜 계정을 연결함
  if (pendingAuth.mode === 'link') {
    if (auth.authStatus === 'unauthenticated') {
      return createFailure(
        '로그인 세션이 만료되었어요. 다시 로그인해 주세요.',
        LOGIN_TARGET,
      );
    }

    if (auth.authStatus !== 'authenticated' || !auth.user) {
      return createFailure(
        '로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.',
        PROFILE_TARGET,
      );
    }

    // 연동을 시작한 계정과 현재 로그인한 계정이 일치하는지 확인함
    if (auth.user.id !== pendingAuth.accountId) {
      return createFailure(
        '연동을 시작한 계정과 현재 로그인한 계정이 일치하지 않아요.',
        PROFILE_TARGET,
      );
    }

    try {
      await linkSocialProvider(input, auth.fetchWithAuth);
    } catch (error) {
      return getRequestFailure(error, pendingAuth);
    }

    if (!isActive()) {
      return { status: 'cancelled' };
    }

    // 내 정보 화면에서 연결 완료 토스트를 표시하도록 결과를 전달함
    return {
      status: 'success',
      href: getLinkResultHref('success', pendingAuth.provider),
      linkedAccountId: pendingAuth.accountId,
    };
  }

  let response: SocialAuthResponse;

  // 최초 인증 목적에 따라 회원가입 또는 로그인 API를 호출함
  try {
    response =
      pendingAuth.mode === 'signup'
        ? await socialSignup({
            ...input,
            accountType: pendingAuth.accountType,
          })
        : await socialLogin(input);
  } catch (error) {
    return getRequestFailure(error, pendingAuth);
  }

  if (!isActive()) {
    return { status: 'cancelled' };
  }

  // 회원가입 및 로그인 성공 이후 기존 인증 Context에 정보를 반영함
  try {
    await auth.login(response.accessToken);
  } catch {
    return createFailure(
      pendingAuth.mode === 'signup'
        ? '회원가입은 완료되었지만 로그인 정보를 불러오지 못했어요. 다시 로그인해 주세요.'
        : '로그인 정보를 불러오지 못했어요. 다시 로그인해 주세요.',
    );
  }

  // 로그인은 세션이 풀리기 전에 보던 화면으로 돌아가고, 회원가입은 메인으로 이동함
  return {
    status: 'success',
    href: pendingAuth.mode === 'login' ? takeReturnPath() : '/',
  };
}

export default function SocialAuthCallback() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { login, authStatus, user, fetchWithAuth } = useAuth();

  const [failure, setFailure] = useState<CallbackFailure | null>(null);

  const activeRef = useRef(false);

  // 세션 복원 중에도 검증된 콜백 정보를 유지함
  const callbackRef = useRef<PreparedCallback | null>(null);

  // 동일한 인가 코드로 API 요청이 중복 실행되지 않도록 관리함
  const requestRef = useRef<Promise<CallbackResult> | null>(null);

  useEffect(() => {
    activeRef.current = true;
    let active = true;

    const cleanup = () => {
      active = false;
      activeRef.current = false;
    };

    if (!requestRef.current) {
      // 콜백 정보는 최초 한 번만 검증하고 저장함
      if (!callbackRef.current) {
        try {
          callbackRef.current = prepareSocialAuth();
        } catch {
          callbackRef.current = createFailure(
            '소셜 인증을 처리하지 못했어요. 다시 시도해 주세요.',
          );
        }
      }

      const callback = callbackRef.current;

      // 계정 연동은 기존 로그인 세션의 복원이 완료될 때까지 대기함
      if (
        callback.status === 'ready' &&
        callback.pendingAuth.mode === 'link' &&
        authStatus === 'initializing'
      ) {
        return cleanup;
      }

      requestRef.current = completeSocialAuth(
        callback,
        {
          login,
          authStatus,
          user,
          fetchWithAuth,
        },
        () => activeRef.current,
      );
    }

    // 인증 결과에 따라 해당 화면으로 이동하거나 오류를 표시함
    void requestRef.current
      .then((result) => {
        if (!active) return;

        if (result.status === 'success') {
          // 계정 연동 성공 시 기존 계정 정보 캐시를 갱신 대상으로 지정함
          if (result.linkedAccountId) {
            void queryClient.invalidateQueries({
              queryKey: ['my', 'account', result.linkedAccountId],
              refetchType: 'none',
            });
          }

          router.replace(result.href);
        } else if (result.status === 'error') {
          // 연결 결과를 내 정보 화면에서 표시하도록 이동함
          if (result.presentation === 'toast') {
            router.replace(result.target.href);
            return;
          }

          // 나머지 인증 오류는 기존 콜백 화면에서 안내함
          setFailure(result);
        }
      })
      .catch(() => {
        if (!active) return;

        setFailure(
          createFailure('소셜 인증을 처리하지 못했어요. 다시 시도해 주세요.'),
        );
      });

    return cleanup;
  }, [login, authStatus, user, fetchWithAuth, queryClient, router]);

  return (
    <section aria-label="소셜 인증">
      {failure ? (
        <>
          <p role="alert">{failure.message}</p>

          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={() => router.replace(failure.target.href)}
          >
            {failure.target.label}
          </Button>
        </>
      ) : (
        <StateMessage title="소셜 인증을 처리하고 있어요." role="status" />
      )}
    </section>
  );
}
