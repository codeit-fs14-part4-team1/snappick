import type { Metadata } from 'next';

export const metadata: Metadata = { title: '내 정보 | SnapPick' };

export default function MyProfilePage() {
  // 공통 메뉴·페이지 제목은 상위 layout.tsx에서 제공합니다.
  // 내 정보 담당자는 이곳에 조회·수정 콘텐츠를 연결합니다.
  // 하위 클라이언트 컴포넌트에서 useMyPageAccount().accountType으로
  // USER / PHOTOGRAPHER의 정보 필드를 구분합니다.
  return null;
}
