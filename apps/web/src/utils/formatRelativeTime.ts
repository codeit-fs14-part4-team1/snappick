type DateValue = string | number | Date;

/** 한국 시간 기준으로 경과 시간을 내림해 표시 */
export function formatRelativeTime(
  value: DateValue,
  now: DateValue = new Date(),
): string {
  const date = new Date(value);
  const nowTime = new Date(now).getTime();
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp) || !Number.isFinite(nowTime)) return '';

  // 서버와 기기의 시각 차이로 미래 시각이 전달되면 '방금'으로 표시
  const elapsed = Math.max(0, nowTime - timestamp);
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (elapsed < minute) return '방금';
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}분 전`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}시간 전`;
  if (elapsed < day * 7) return `${Math.floor(elapsed / day)}일 전`;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${getPart('year')}.${getPart('month')}.${getPart('day')}`;
}
