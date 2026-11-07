import { useColumnCount } from '@/hooks/useColumnCount';
import { distributeToColumns } from '@/lib/masonry';
import type { FeedPhoto } from '../types';
import FeedCard from './FeedCard';
import styles from './FeedMasonry.module.css';

type FeedMasonryProps = {
  photos: FeedPhoto[];
};

export default function FeedMasonry({ photos }: FeedMasonryProps) {
  const columnCount = useColumnCount(5);
  if (columnCount === null) return null;
  const columns = distributeToColumns(photos, columnCount);
  return (
    <div className={styles.masonry} role="list" aria-label="사진 목록">
      {columns.map((column, index) => (
        <div key={index} className={styles.column} role="presentation">
          {column.map((photo) => (
            <div key={photo.photoId} role="listitem">
              {/* 이 안의 내용을 props로 받아서 넣을것 */}
              <FeedCard photo={photo} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
