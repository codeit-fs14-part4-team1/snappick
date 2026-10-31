import type { Region } from '@snappick/shared';

// 일반 사용자와 사진작가가 공통으로 사용하는 정보를 정의함
type AuthUserBase = {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  created_at: string;
};

// 일반 사용자 정보를 정의함
export type AuthUser = AuthUserBase &
  (
    | {
        account_type: 'USER';
      }
    | {
        account_type: 'PHOTOGRAPHER';
        career: number | null;
        regions: Region[];
        introduction: string | null;
      }
  );
