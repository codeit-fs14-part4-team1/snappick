type Sized = { width: number; height: number };
//카드 간격 추정값(열 너비 대비): 어느 열에 넣을지 판단용, 실제 간격은 CSS
const GAP_RATIO = 0.05;

export function getAspectRatio(item: Sized): number {
  if (!(item.width > 0 && item.height > 0)) return 1;
  return item.height / item.width;
}

export function distributeToColumns<T extends Sized>(
  items: T[],
  columnCount: number,
): T[][] {
  if (!Number.isInteger(columnCount) || columnCount < 1) return [];
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  const columnHeights = Array.from({ length: columnCount }, () => 0);

  items.forEach((item) => {
    const ratio = getAspectRatio(item);
    const shortestIndex = columnHeights.indexOf(Math.min(...columnHeights));
    const gap = columns[shortestIndex].length > 0 ? GAP_RATIO : 0;
    columns[shortestIndex].push(item);
    columnHeights[shortestIndex] += gap + ratio;
  });

  return columns;
}
