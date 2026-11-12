import type { Provider } from '../../generated/prisma/enums.js';
import { getGoogleProfile } from './google.oauth.js';
import { getKakaoProfile } from './kakao.oauth.js';
import { getNaverProfile } from './naver.oauth.js';

// 소셜 로그인 제공자에게서 받아 온 사용자 정보 (제공자마다 응답이 달라 이 형태로 맞춘다)
export type SocialProfile = {
  // 제공자의 사용자 ID (auth_providers.provider_user_id)
  providerUserId: string;
  // 이메일 제공에 동의하지 않았으면 null
  email: string | null;
  // 제공자가 인증한 이메일인지
  emailVerified: boolean;
  // 제공자 프로필의 닉네임 (가입할 때 우리 닉네임으로 쓴다). 없으면 null
  nickname: string | null;
};

// FE가 소셜 로그인 콜백에서 받은 값
export type SocialAuthorization = {
  code: string;
  redirectUri: string;
  // 로그인 URL에 넣었던 state (네이버는 토큰 교환에 필요, 카카오는 쓰지 않음)
  state?: string | undefined;
};

export type SocialProvider = Exclude<Provider, 'BASIC'>;

export async function getSocialProfile(
  provider: SocialProvider,
  authorization: SocialAuthorization,
): Promise<SocialProfile> {
  switch (provider) {
    case 'KAKAO':
      return getKakaoProfile(authorization);
    case 'NAVER':
      return getNaverProfile(authorization);
    case 'GOOGLE':
      return getGoogleProfile(authorization);
  }
}
