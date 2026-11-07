import type { FeedPhoto } from './types';

const GAP_RATIO = 0.05;

export function getAspectRatio(photo: FeedPhoto): number {
  if (!(photo.width > 0 && photo.height > 0)) return 1;
  return photo.height / photo.width;
}

export function distributeToColumns(
  photos: FeedPhoto[],
  columnCount: number,
): FeedPhoto[][] {
  if (!Number.isInteger(columnCount) || columnCount < 1) return [];
  const columns: FeedPhoto[][] = Array.from({ length: columnCount }, () => []);
  const columnHeights = Array.from({ length: columnCount }, () => 0);

  photos.forEach((photo) => {
    const ratio = getAspectRatio(photo);
    const shortestIndex = columnHeights.indexOf(Math.min(...columnHeights));
    const gap = columns[shortestIndex].length > 0 ? GAP_RATIO : 0;
    columns[shortestIndex].push(photo);
    columnHeights[shortestIndex] += gap + ratio;
  });

  return columns;
}
