import { Category, Region, Style } from '@snappick/shared';
import { formatDate } from '@/utils/dateTime';
import {
  CategoryLabel,
  RegionLabel,
  StyleLabel,
} from '@/constants/enum-labels';
import { timeSlotLabels } from './SchedulePicker';
import styles from './InquiryCard.module.css';

export default function InquiryCard({
  payload,
  isMine,
}: {
  payload: unknown;
  isMine: boolean;
}) {
  const info: Record<string, unknown> =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const region = Object.values(Region).find((value) => value === info.region);
  const category = Object.values(Category).find(
    (value) => value === info.category,
  );
  const concepts = Object.values(Style).filter(
    (value) => Array.isArray(info.concept) && info.concept.includes(value),
  );
  const time = (
    Object.keys(timeSlotLabels) as (keyof typeof timeSlotLabels)[]
  ).find((value) => value === info.timeSlot);
  const date =
    typeof info.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(info.date)
      ? formatDate(info.date)
      : '';
  const location = typeof info.location === 'string' ? info.location : '';
  const rows = [
    [
      '촬영 일정',
      [date, time && timeSlotLabels[time]].filter(Boolean).join(' '),
    ],
    [
      '장소·지역',
      [region && RegionLabel[region], location].filter(Boolean).join(' '),
    ],
    ['콘셉트·스타일', concepts.map((value) => StyleLabel[value]).join(', ')],
    ['목적·카테고리', category && CategoryLabel[category]],
  ];
  return (
    <div className={styles.card} data-mine={isMine}>
      <strong>
        {isMine ? '촬영 문의를 보냈어요' : '촬영 문의가 도착했어요'}
      </strong>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '미정'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
