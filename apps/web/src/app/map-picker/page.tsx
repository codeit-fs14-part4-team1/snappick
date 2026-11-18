import type { Metadata } from 'next';
import NaverMapPicker from '@/features/map/components/NaverMapPicker';

export const metadata: Metadata = {
  title: '위치 선택 | SnapPick',
};

// 견적 작성 등에서 window.open으로 여는 지도 팝업
export default function MapPickerPage() {
  return <NaverMapPicker />;
}
