export type DateValue = string | number | Date;

const TIME_ZONE = 'Asia/Seoul';
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function getParts(value: DateValue) {
  // 날짜만 있는 값은 시간대 변환 없이 달력 날짜 그대로 사용
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      return null;
    const [year, month, day] = value.split('-');
    return {
      year,
      month,
      day,
      weekday: date.getUTCDay(),
      hour: null,
      minute: null,
    };
  }

  if (typeof value === 'string') {
    const timestamp =
      /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.exec(
        value,
      );
    // Date가 잘못된 일자를 다음 달로 보정하기 전에 달력 날짜를 검사합니다.
    if (!timestamp || !getParts(timestamp[1])) return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  return {
    year,
    month,
    day,
    weekday: new Date(`${year}-${month}-${day}T00:00:00Z`).getUTCDay(),
    hour: Number(part('hour')),
    minute: part('minute'),
  };
}

/** YYYY.MM.DD. 날짜 문자열은 그대로, 시각은 한국 날짜로 표시합니다. 잘못된 값은 빈 문자열입니다. */
export function formatDate(value: DateValue): string {
  const parts = getParts(value);
  return parts ? `${parts.year}.${parts.month}.${parts.day}` : '';
}

/** YYYY.MM.DD (목) */
export function formatDateWithWeekday(value: DateValue): string {
  const parts = getParts(value);
  return parts ? `${formatDate(value)} (${weekdays[parts.weekday]})` : '';
}

/** 2026년 11월 19일 목요일 */
export function formatLongDate(value: DateValue): string {
  const parts = getParts(value);
  return parts
    ? `${parts.year}년 ${Number(parts.month)}월 ${Number(parts.day)}일 ${weekdays[parts.weekday]}요일`
    : '';
}

/** 한국 시간의 오전/오후 h:mm. 시각이 없는 날짜 문자열은 빈 문자열입니다. */
export function formatTime(value: DateValue): string {
  const parts = getParts(value);
  if (!parts || parts.hour === null) return '';
  return `${parts.hour < 12 ? '오전' : '오후'} ${parts.hour % 12 || 12}:${parts.minute}`;
}

/** 한국 날짜를 비교합니다. 기준 시각은 호출부에서 전달합니다. 잘못된 값은 false입니다. */
export function isSameDate(value: DateValue, reference: DateValue): boolean {
  const date = formatDate(value);
  return date !== '' && date === formatDate(reference);
}
