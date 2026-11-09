//사진 공유: 터치 기기는 공유 시트, 그 외는 링크 복사, 주소는 페이지가 getShareUrl로 넘김

import { useRef } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import ShareIcon from '@/components/ui/ShareIcon';

type PhotoShareButtonProps = {
  photoId: string;
  getShareUrl: (photoId: string) => string;
  className?: string;
};

export default function PhotoShareButton({
  photoId,
  getShareUrl,
  className,
}: PhotoShareButtonProps) {
  const { showToast } = useToast();
  //공유 시트가 열려 있는 동안 재클릭 무시 (중복 호출 시 InvalidStateError)
  const sharingRef = useRef(false);

  async function handleShare() {
    if (sharingRef.current) return;
    sharingRef.current = true;
    const url = getShareUrl(photoId);

    //터치 기기만 공유 시트, 마우스 환경(데스크톱)은 링크 복사
    const isTouchDevice = window.matchMedia(
      '(hover: none) and (pointer: coarse)',
    ).matches;

    try {
      if (isTouchDevice && navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('링크를 복사했어요.');
    } catch (error) {
      //시트를 그냥 닫은 경우는 실패가 아님
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast('링크를 공유하지 못했어요. 다시 시도해 주세요.', 'error');
    } finally {
      sharingRef.current = false;
    }
  }

  return (
    <button
      type="button"
      className={className}
      aria-label="사진 링크 공유"
      onClick={handleShare}
    >
      <ShareIcon />
    </button>
  );
}
