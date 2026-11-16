import { HttpError } from '../../utils/http-error.js';
import type { SocialAuthorization, SocialProfile } from './oauth.service.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REQUEST_TIMEOUT_MS = 5000;

type GoogleToken = { access_token: string };

type GoogleUser = {
  sub: string;
  email?: string;
  email_verified?: boolean;
};

// 인가 코드가 잘못됐거나 만료·재사용됨, redirect URI 불일치 등 (FE는 구글 로그인을 다시 시작한다)
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

// 구글 호출. 4xx는 인가 실패(401), 구글 쪽 장애·시간 초과는 502로 바꾼다
async function googleFetch<T>(url: string, init: RequestInit): Promise<T> {
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

// 인가 코드를 구글 access token으로 바꾼다 (Client Secret이 필요해 서버에서 한다)
async function exchangeCode({
  code,
  redirectUri,
}: SocialAuthorization): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpError(
      503,
      'SOCIAL_LOGIN_NOT_CONFIGURED',
      '구글 로그인이 아직 설정되지 않았어요.',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const token = await googleFetch<GoogleToken>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return token.access_token;
}

/**
 * FE가 구글 로그인 콜백에서 받은 인가 코드로 구글 사용자 정보를 가져온다
 * 1. 인가 코드 → 구글 access token (우리 Client ID·Secret으로 발급받으므로 우리 앱의 로그인임이 보장된다)
 * 2. access token → 사용자 ID(sub), 이메일, 이메일 인증 여부 (scope: openid email)
 * 구글에는 별명이 없고 name은 실명이라 받지 않는다 → 닉네임은 null (가입 시 임시 닉네임)
 */
export async function getGoogleProfile(
  authorization: SocialAuthorization,
): Promise<SocialProfile> {
  const accessToken = await exchangeCode(authorization);
  const user = await googleFetch<GoogleUser>(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!user.sub) {
    throw invalidSocialAuth();
  }

  return {
    providerUserId: user.sub,
    email: user.email ? user.email.trim().toLowerCase() : null,
    emailVerified: user.email_verified === true,
    nickname: null,
  };
}
