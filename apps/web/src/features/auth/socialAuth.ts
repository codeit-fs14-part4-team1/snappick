import type {
  SocialAuthIntent,
  SocialLinkIntent,
  SocialProvider,
} from './types';

// 소셜 회원가입, 로그인 및 계정 연동 목적을 통합함
type SocialAuthRequestIntent = SocialAuthIntent | SocialLinkIntent;

// 소셜 인증 요청 중 임시로 저장할 데이터 타입 정의
type PendingSocialAuth = SocialAuthRequestIntent & {
  provider: SocialProvider;
  state: string;
  redirectUri: string;
  createdAt: number;
};

// 소셜 인증 요청 정보의 저장 키 및 유효 시간 정의
const SOCIAL_AUTH_STORAGE_KEY = 'snappick:social-auth';
const SOCIAL_AUTH_TTL_MS = 10 * 60 * 1000;

// 소셜 서비스별 인증 URL 및 환경 변수 정의
const SOCIAL_AUTH_CONFIG = {
  KAKAO: {
    authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
    clientId: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY,
    redirectUri: process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI,
  },
  NAVER: {
    authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize',
    clientId: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID,
    redirectUri: process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI,
  },
  GOOGLE: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    redirectUri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
  },
};

// 등록된 콜백 주소가 현재 서비스에서 사용할 수 있는 주소인지 확인함
function getRedirectUri(provider: SocialProvider): string {
  const redirectUri = SOCIAL_AUTH_CONFIG[provider].redirectUri?.trim();

  if (!redirectUri) {
    throw new Error('소셜 로그인 콜백 주소가 설정되지 않았어요.');
  }

  const url = new URL(redirectUri);

  if (url.origin !== window.location.origin || url.search || url.hash) {
    throw new Error('소셜 로그인 콜백 주소가 올바르지 않아요.');
  }

  // 서로 다른 소셜 서비스에서 동일한 콜백 주소를 사용하지 않도록 함
  const isDuplicated = Object.entries(SOCIAL_AUTH_CONFIG).some(
    ([key, config]) =>
      key !== provider && config.redirectUri?.trim() === redirectUri,
  );

  if (isDuplicated) {
    throw new Error('소셜 서비스별 콜백 주소를 확인해 주세요.');
  }

  return redirectUri;
}

// 브라우저에 저장된 소셜 인증 요청 정보의 유효성을 확인함
function isPendingSocialAuth(value: unknown): value is PendingSocialAuth {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    (data.provider === 'KAKAO' ||
      data.provider === 'NAVER' ||
      data.provider === 'GOOGLE') &&
    typeof data.state === 'string' &&
    data.state.length > 0 &&
    typeof data.redirectUri === 'string' &&
    typeof data.createdAt === 'number' &&
    Number.isFinite(data.createdAt) &&
    (data.mode === 'login' ||
      (data.mode === 'signup' &&
        (data.accountType === 'USER' || data.accountType === 'PHOTOGRAPHER')) ||
      (data.mode === 'link' &&
        typeof data.accountId === 'string' &&
        data.accountId.trim().length > 0))
  );
}

// 소셜 회원가입, 로그인 또는 계정 연동을 시작함
export function startSocialAuth(
  provider: SocialProvider,
  intent: SocialAuthRequestIntent,
): void {
  // 계정 연동 요청에는 연동을 시작한 계정 정보가 필요함
  if (intent.mode === 'link' && !intent.accountId.trim()) {
    throw new Error('연동할 계정 정보를 확인하지 못했어요.');
  }

  const config = SOCIAL_AUTH_CONFIG[provider];
  const clientId = config.clientId?.trim();

  if (!clientId) {
    throw new Error('소셜 로그인 설정을 확인해 주세요.');
  }

  const redirectUri = getRedirectUri(provider);

  // 인증 요청 위조 방지를 위해 요청마다 고유한 state를 생성함
  const state = window.crypto.randomUUID();

  const pendingAuth: PendingSocialAuth = {
    ...intent,
    provider,
    state,
    redirectUri,
    createdAt: Date.now(),
  };

  // 소셜 인증 페이지에서 돌아온 후에도 기존 인증 목적을 유지함
  sessionStorage.setItem(SOCIAL_AUTH_STORAGE_KEY, JSON.stringify(pendingAuth));

  // 소셜 서비스별 인가 코드 요청 URL을 생성함
  const authorizeUrl = new URL(config.authorizeUrl);

  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  // 구글은 사용자 식별 정보 및 이메일 조회 권한만 요청함
  if (provider === 'GOOGLE') {
    authorizeUrl.searchParams.set('scope', 'openid email');
  }

  window.location.assign(authorizeUrl.toString());
}

// 콜백에서 전달받은 state와 기존 인증 요청 정보를 검증함
export function consumeSocialAuth(returnedState: string): PendingSocialAuth {
  const storedAuth = sessionStorage.getItem(SOCIAL_AUTH_STORAGE_KEY);

  if (!storedAuth) {
    throw new Error('소셜 인증 요청 정보가 없어요. 다시 시도해 주세요.');
  }

  let pendingAuth: unknown;

  try {
    pendingAuth = JSON.parse(storedAuth);
  } catch {
    sessionStorage.removeItem(SOCIAL_AUTH_STORAGE_KEY);
    throw new Error('소셜 인증 요청 정보가 올바르지 않아요.');
  }

  if (
    !isPendingSocialAuth(pendingAuth) ||
    pendingAuth.createdAt > Date.now() ||
    Date.now() - pendingAuth.createdAt > SOCIAL_AUTH_TTL_MS
  ) {
    sessionStorage.removeItem(SOCIAL_AUTH_STORAGE_KEY);
    throw new Error('소셜 인증 요청이 만료되었어요. 다시 시도해 주세요.');
  }

  if (pendingAuth.state !== returnedState) {
    throw new Error('소셜 인증 요청을 확인하지 못했어요.');
  }

  const redirectUri = getRedirectUri(pendingAuth.provider);
  const callbackUrl = new URL(redirectUri);

  // 최초 인증 요청과 실제 콜백 주소가 일치하는지 확인함
  if (
    pendingAuth.redirectUri !== redirectUri ||
    callbackUrl.origin !== window.location.origin ||
    callbackUrl.pathname !== window.location.pathname
  ) {
    throw new Error('소셜 로그인 콜백 주소가 일치하지 않아요.');
  }

  // 동일한 인증 요청 정보가 재사용되지 않도록 검증 후 제거함
  sessionStorage.removeItem(SOCIAL_AUTH_STORAGE_KEY);

  return pendingAuth;
}
