import { HttpError } from '../../utils/http-error.js';
import type { SocialAuthorization, SocialProfile } from './oauth.service.js';

const KAKAO_AUTH = 'https://kauth.kakao.com';
const KAKAO_API = 'https://kapi.kakao.com';
const REQUEST_TIMEOUT_MS = 5000;

type KakaoToken = { access_token: string };

type KakaoUser = {
  id: number;
  kakao_account?: {
    profile_nickname_needs_agreement?: boolean;
    profile?: { nickname?: string };
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
  };
};

// 인가 코드가 잘못됐거나 만료·재사용됨, redirect URI 불일치 등 (FE는 카카오 로그인을 다시 시작한다)
const invalidSocialAuth = () =>
  new HttpError(
    401,
    'INVALID_SOCIAL_AUTH',
    '소셜 로그인이 정상적으로 수행되지 않았습니다. 다시 시도해 주세요.',
  );

const providerUnavailable = () =>
  new HttpError(
    502,
    'SOCIAL_PROVIDER_UNAVAILABLE',
    '소셜 로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  );

// 카카오 호출. 4xx는 인가 실패(401), 카카오 쪽 장애·시간 초과는 502로 바꾼다
async function kakaoFetch<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw providerUnavailable();
  }

  if (response.status >= 400 && response.status < 500) {
    throw invalidSocialAuth();
  }
  if (!response.ok) {
    throw providerUnavailable();
  }
  return (await response.json()) as T;
}

// 인가 코드를 카카오 access token으로 바꾼다 (REST API 키로만 바꿀 수 있어 서버에서 한다)
async function exchangeCode({
  code,
  redirectUri,
}: SocialAuthorization): Promise<string> {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) {
    throw new HttpError(
      503,
      'SOCIAL_LOGIN_NOT_CONFIGURED',
      '카카오 로그인이 아직 설정되지 않았어요.',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: restApiKey,
    redirect_uri: redirectUri,
    code,
  });
  // 카카오 콘솔에서 Client Secret을 켰을 때만 필요
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  if (clientSecret) body.set('client_secret', clientSecret);

  const token = await kakaoFetch<KakaoToken>(`${KAKAO_AUTH}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body,
  });
  return token.access_token;
}

/**
 * FE가 카카오 로그인 콜백에서 받은 인가 코드로 카카오 사용자 정보를 가져온다
 * 1. 인가 코드 → 카카오 access token (우리 REST API 키로 발급받으므로 우리 앱의 로그인임이 보장된다)
 * 2. access token → 사용자 ID, 닉네임(필수 동의), 이메일(선택 동의라 없을 수 있음)
 */
export async function getKakaoProfile(
  authorization: SocialAuthorization,
): Promise<SocialProfile> {
  const accessToken = await exchangeCode(authorization);
  const user = await kakaoFetch<KakaoUser>(`${KAKAO_API}/v2/user/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const account = user.kakao_account;
  const email =
    account?.email && account.email_needs_agreement !== true
      ? account.email.trim().toLowerCase()
      : null;
  const nickname =
    account?.profile?.nickname &&
    account.profile_nickname_needs_agreement !== true
      ? account.profile.nickname
      : null;

  return {
    providerUserId: String(user.id),
    email,
    emailVerified:
      account?.is_email_valid === true && account.is_email_verified === true,
    nickname,
  };
}
