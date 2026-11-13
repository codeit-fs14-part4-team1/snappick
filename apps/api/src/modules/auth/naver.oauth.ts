import { HttpError } from '../../utils/http-error.js';
import type { SocialAuthorization, SocialProfile } from './oauth.service.js';

const NAVER_AUTH = 'https://nid.naver.com';
const NAVER_API = 'https://openapi.naver.com';
const REQUEST_TIMEOUT_MS = 5000;

// 네이버는 토큰 교환이 실패해도 200에 error 필드로 알려 준다
type NaverToken = { access_token?: string; error?: string };

type NaverUser = {
  resultcode: string;
  response?: {
    id: string;
    nickname?: string;
    email?: string;
  };
};

// 인가 코드가 잘못됐거나 만료·재사용됨, state 불일치 등 (FE는 네이버 로그인을 다시 시작한다)
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

// 네이버 호출. 4xx는 인가 실패(401), 네이버 쪽 장애·시간 초과는 502로 바꾼다
async function naverFetch<T>(url: string, init: RequestInit): Promise<T> {
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

// 인가 코드를 네이버 access token으로 바꾼다 (Client Secret이 필요해 서버에서 한다)
async function exchangeCode({
  code,
  state,
}: SocialAuthorization): Promise<string> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpError(
      503,
      'SOCIAL_LOGIN_NOT_CONFIGURED',
      '네이버 로그인이 아직 설정되지 않았어요.',
    );
  }
  if (!state) {
    throw new HttpError(
      400,
      'VALIDATION_FAILED',
      '소셜 로그인이 정상적으로 수행되지 않았습니다.',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    state,
  });
  const token = await naverFetch<NaverToken>(`${NAVER_AUTH}/oauth2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (token.error || !token.access_token) {
    throw invalidSocialAuth();
  }
  return token.access_token;
}

/**
 * FE가 네이버 로그인 콜백에서 받은 인가 코드·state로 네이버 사용자 정보를 가져온다
 * 1. 인가 코드 → 네이버 access token (우리 Client ID·Secret으로 발급받으므로 우리 앱의 로그인임이 보장된다)
 * 2. access token → 사용자 ID, 별명, 이메일 (개발자센터 [제공 정보]에서 고른 항목만 온다)
 * 네이버는 이메일 인증 여부를 따로 주지 않는다. 네이버 계정에 등록된 이메일이라 인증된 것으로 본다
 */
export async function getNaverProfile(
  authorization: SocialAuthorization,
): Promise<SocialProfile> {
  const accessToken = await exchangeCode(authorization);
  const user = await naverFetch<NaverUser>(`${NAVER_API}/v1/nid/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (user.resultcode !== '00' || !user.response?.id) {
    throw invalidSocialAuth();
  }

  const { id, nickname, email } = user.response;
  const normalizedEmail = email ? email.trim().toLowerCase() : null;

  return {
    providerUserId: id,
    email: normalizedEmail,
    emailVerified: normalizedEmail !== null,
    nickname: nickname?.trim() ? nickname : null,
  };
}
