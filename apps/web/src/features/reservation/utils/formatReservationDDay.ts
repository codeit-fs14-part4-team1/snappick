import { formatDate } from '@/utils/dateTime';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 한국 시간 기준의 달력 날짜를 UTC 자정 값으로 변환함
function getKstCalendarDay(value: string | Date): number | null {
  const formattedDate = formatDate(value);

  if (!formattedDate) {
    return null;
  }

  const [year, month, day] = formattedDate.split('.').map(Number);

  return Date.UTC(year, month - 1, day);
}

// 촬영일까지 남은 날짜를 한국 시간 기준으로 계산함
export function formatReservationDDay(
  shootAt: string,
  now: Date = new Date(),
): string | null {
  const shootingDay = getKstCalendarDay(shootAt);
  const today = getKstCalendarDay(now);

  if (shootingDay === null || today === null) {
    return null;
  }

  const remainingDays = Math.round((shootingDay - today) / MS_PER_DAY);

  // 촬영일이 지난 경우 D-day를 표시하지 않음
  if (remainingDays < 0) {
    return null;
  }

  // 촬영 당일과 촬영 예정일을 구분함
  return remainingDays === 0 ? 'D-Day' : `D-${remainingDays}`;
}
