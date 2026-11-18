'use client';

// ==================== [임시] 견적 모달 개발용 미리보기 (작업 후 파일 삭제) ====================
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { PickedLocation } from '@/features/map/naver-maps';
import { useMapPicker } from '@/features/map/useMapPicker';

// /chats 진입 시 견적 모달을 바로 띄워 UI를 확인하기 위한 임시 컴포넌트
export default function QuoteFormModalPreview() {
  const [open, setOpen] = useState(true);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const openMapPicker = useMapPicker(setLocation);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="견적서 작성">
      <label>
        촬영 장소
        <input
          readOnly
          value={location?.address ?? ''}
          placeholder="클릭해서 지도에서 위치를 골라 주세요"
          onClick={openMapPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openMapPicker();
            }
          }}
        />
      </label>
    </Modal>
  );
}
// ==================== [임시] 견적 모달 개발용 미리보기 끝 ====================
