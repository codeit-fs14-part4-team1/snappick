import type { Metadata } from 'next';
import MyProfile from '@/features/my/profile/MyProfile';

export const metadata: Metadata = { title: '내 정보 | SnapPick' };

// 계정 유형별 내 정보 콘텐츠를 렌더링함
export default function MyProfilePage() {
  return <MyProfile />;
}
