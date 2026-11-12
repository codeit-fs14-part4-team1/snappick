import { HttpError } from '../../utils/http-error.js';
import type { Provider } from '../../generated/prisma/enums.js';
import { getKakaoProfile } from './kakao.oauth.js';

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
};

export type SocialProvider = Exclude<Provider, 'BASIC'>;

export async function getSocialProfile(
  provider: SocialProvider,
  authorization: SocialAuthorization,
): Promise<SocialProfile> {
  switch (provider) {
    case 'KAKAO':
      return getKakaoProfile(authorization);
    case 'GOOGLE':
    case 'NAVER':
      throw new HttpError(
        501,
        'NOT_IMPLEMENTED',
        '아직 지원하지 않는 소셜 로그인입니다.',
      );
  }
}
