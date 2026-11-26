// 일반 사용자와 사진작가가 공통으로 사용하는 로그인 방식 타입 정의
export type AccountProvider = 'BASIC' | 'KAKAO' | 'NAVER' | 'GOOGLE';

// GET /auth/account
// 현재 로그인한 계정의 로그인 방식 및 연결된 계정 정보 응답 타입 정의
export type MyAccountResponse = {
  provider: AccountProvider;
  email: string | null;
  providers: {
    provider: AccountProvider;
    email: string | null;
  }[];
};

// PATCH /users/me
// 일반 사용자 닉네임 수정 API의 요청 데이터 타입 정의
export type UpdateMyNicknameInput = {
  nickname: string;
};

// PATCH /users/me
// 일반 사용자 닉네임 수정 성공 시 반환되는 응답 데이터 타입 정의
export type UpdateMyNicknameResponse = {
  id: string;
  accountType: 'USER';
  nickname: string;
  profileImageUrl: string | null;
};

// PATCH /auth/password
// 이메일 로그인 사용자의 비밀번호 변경 요청 데이터 타입 정의
export type ChangeMyPasswordInput = {
  currentPassword: string;
  newPassword: string;
};
