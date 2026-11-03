import Image from 'next/image';
import type { FeedPhoto } from '../types';
import styles from './FeedCard.module.css';

//photo를 담은 props객체의 타입
type FeedCardProps = {
  photo: FeedPhoto;
};

//사진 카드 하나
export default function FeedCard({ photo }: FeedCardProps) {
  return (
    <article className={styles.card}>
      <Image
        src={photo.imageUrl}
        alt={`${photo.photographer.nickname}의 사진`}
        width={photo.width}
        height={photo.height}
        sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 20vw "
        className={styles.image}
      />
    </article>
  );
}
