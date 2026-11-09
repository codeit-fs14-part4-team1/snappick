import Modal from '@/components/ui/Modal';
import { usePhotoDetail } from '../hooks/usePhotoDetail';
import Button from '@/components/ui/Button';
import styles from './PhotoDetailModal.module.css';
import PhotoDetailContent from './PhotoDetailContent';
import PhotographerOtherPhotos from './PhotographerOtherPhotos';
import PhotoDetailSkeleton from './PhotoDetailSkeleton';
import { useEffect, useRef } from 'react';

type PhotoDetailModalProps = {
  photoId: string | null;
  onClose: () => void;
  onSelectPhoto?: (photoId: string) => void;
  getShareUrl?: (photoId: string) => string;
};

export default function PhotoDetailModal({
  photoId,
  onClose,
  onSelectPhoto,
  getShareUrl,
}: PhotoDetailModalProps) {
  const { data, status, refetch } = usePhotoDetail(photoId);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [photoId]);

  return (
    <Modal
      open={photoId !== null}
      onClose={onClose}
      showTitle={false}
      title="사진 상세"
      closeButtonPosition="outside"
      className={styles.surface}
    >
      <div ref={topRef} />
      {status === 'pending' && <PhotoDetailSkeleton />}
      {status === 'error' && (
        <div role="alert" className={styles.message}>
          <p>사진을 불러오지 못했어요</p>
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      )}
      {status === 'success' && (
        <>
          <PhotoDetailContent photo={data} getShareUrl={getShareUrl} />
          {onSelectPhoto && (
            <PhotographerOtherPhotos
              photographerId={data.photographer.id}
              excludePhotoId={data.photoId}
              onSelectPhoto={onSelectPhoto}
            />
          )}
        </>
      )}
    </Modal>
  );
}
