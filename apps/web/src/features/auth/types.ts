import type { AccountType, Region } from '@snappick/shared';

// 일반 사용자와 사진작가가 공통으로 사용하는 정보를 정의함
type AuthUserBase = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  createdAt: string;
};

// 일반 사용자 정보를 정의함
export type AuthUser = AuthUserBase &
  (
    | {
        accountType: 'USER';
      }
    | {
        accountType: 'PHOTOGRAPHER';
        career: number | null;
        regions: Region[];
        introduction: string | null;
      }
  );

export type FetchWithAuthOptions = {
  optionalAuth?: boolean;
};

export type FetchWithAuth = <T>(
  path: string,
  options?: RequestInit,
  config?: FetchWithAuthOptions,
) => Promise<T | undefined>;

// 지원하는 소셜 로그인 방식 타입 정의
export type SocialProvider = 'KAKAO' | 'NAVER' | 'GOOGLE';

// 소셜 인증 요청 목적 및 회원 유형 정의
export type SocialAuthIntent =
  | {
      mode: 'login';
    }
  | {
      mode: 'signup';
      accountType: AccountType;
    };

// POST /auth/login
// 소셜 로그인 API의 요청 데이터 타입 정의
export type SocialLoginInput = {
  provider: SocialProvider;
  code: string;
  redirectUri: string;
  state: string;
};

// POST /auth/signup
// 소셜 회원가입 시에는 선택한 회원 유형을 함께 전달함
export type SocialSignupInput = SocialLoginInput & {
  accountType: AccountType;
};

// 소셜 회원가입 및 로그인 성공 응답 타입 정의
export type SocialAuthResponse = {
  accessToken: string;
};

// 현재 로그인한 계정에 소셜 로그인 방식을 연동하기 위한 인증 정보
export type SocialLinkIntent = {
  mode: 'link';
  accountId: string;
};
