'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Modal from '@/components/ui/Modal';
import {
  formatDate,
  formatDateWithWeekday as dateLabel,
} from '@/utils/dateTime';
import styles from './InquiryForm.module.css';
import pickerStyles from './SchedulePicker.module.css';

export const timeSlotLabels = {
  MORNING: '오전',
  AFTERNOON: '오후',
  EVENING: '저녁',
  UNDECIDED: '미정',
} as const;
export type InquiryTimeSlot = keyof typeof timeSlotLabels;

export default function SchedulePicker({
  referenceDate,
  dateOnly = false,
  value,
  onDateChange,
  triggerClassName,
  presentation = 'popover',
}: {
  referenceDate: string;
  dateOnly?: boolean;
  value?: string;
  onDateChange?: (date: string) => void;
  triggerClassName?: string;
  presentation?: 'popover' | 'modal';
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [minDate, setMinDate] = useState('');
  const [internalDate, setDate] = useState('');
  const date = value ?? internalDate;
  const [timeSlot, setTimeSlot] = useState<InquiryTimeSlot>('UNDECIDED');
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState<InquiryTimeSlot>('UNDECIDED');
  const [month, setMonth] = useState(() => referenceDate.slice(0, 7));
  const [year, monthNumber] = month.split('-').map(Number);
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  useEffect(() => {
    if (!open) return;

    let timer: ReturnType<typeof setTimeout>;

    function scheduleMidnight() {
      const today = formatDate(new Date()).replaceAll('.', '-');
      const nextMidnight =
        Date.parse(`${today}T00:00:00+09:00`) + 24 * 60 * 60 * 1000;
      timer = setTimeout(refreshDate, Math.max(1, nextMidnight - Date.now()));
    }

    function refreshDate() {
      clearTimeout(timer);
      const today = formatDate(new Date()).replaceAll('.', '-');
      setMinDate(today);
      // 저장된 날짜는 유지하고, 달력에서 선택 중인 지난 날짜만 해제합니다.
      setDraftDate((selected) =>
        selected && selected < today ? '' : selected,
      );
      setMonth((current) =>
        current < today.slice(0, 7) ? today.slice(0, 7) : current,
      );
      scheduleMidnight();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') refreshDate();
    }

    scheduleMidnight();
    window.addEventListener('focus', refreshDate);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refreshDate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open || presentation === 'modal') return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open, presentation]);

  function moveMonth(delta: number) {
    setMonth(
      new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
        .toISOString()
        .slice(0, 7),
    );
  }

  return (
    <div
      ref={root}
      className={styles.schedule}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <input type="hidden" name="date" value={date} />
      {!dateOnly && <input type="hidden" name="timeSlot" value={timeSlot} />}
      <button
        ref={trigger}
        type="button"
        className={triggerClassName ?? styles.scheduleTrigger}
        aria-label={dateOnly ? '촬영 날짜' : '촬영 일정'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => {
          const today = formatDate(new Date()).replaceAll('.', '-');
          setMinDate(today);
          setDraftDate(date >= today ? date : '');
          setDraftTime(timeSlot);
          setMonth((date >= today ? date : today).slice(0, 7));
          setOpen(!open);
        }}
        data-empty={!date && timeSlot === 'UNDECIDED'}
      >
        {dateOnly
          ? date
            ? dateLabel(date)
            : '촬영 날짜를 선택해 주세요'
          : date || timeSlot !== 'UNDECIDED'
            ? `${date ? dateLabel(date) + ' ' : ''}${timeSlotLabels[timeSlot]}`
            : '날짜와 시간대를 선택해 주세요'}
      </button>
      {open && (
        <PickerLayer
          id={id}
          title={dateOnly ? '촬영 날짜 선택' : '촬영 날짜와 시간대 선택'}
          presentation={presentation}
          onClose={() => setOpen(false)}
        >
          <div className={styles.month}>
            <button
              type="button"
              disabled={month <= minDate.slice(0, 7)}
              aria-label="이전 달"
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <strong aria-live="polite">
              {year}년 {monthNumber}월
            </strong>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
          <div className={styles.days}>
            {Array.from('일월화수목금토').map((day) => (
              <span key={day}>{day}</span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const value = `${month}-${String(day).padStart(2, '0')}`;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={`${year}년 ${monthNumber}월 ${day}일`}
                  aria-pressed={draftDate === value}
                  disabled={value < minDate}
                  onClick={() => {
                    if (value < formatDate(new Date()).replaceAll('.', '-'))
                      return;
                    setDraftDate(value);
                    if (dateOnly) {
                      setDate(value);
                      onDateChange?.(value);
                    }
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {!dateOnly && (
            <fieldset className={styles.choices}>
              <legend>시간대</legend>
              <div className={styles.timeSlots}>
                {Object.entries(timeSlotLabels).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={draftTime === value}
                    onClick={() => setDraftTime(value as InquiryTimeSlot)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <button
            type="button"
            className={styles.selectSchedule}
            disabled={dateOnly && !draftDate}
            onClick={() => {
              const today = formatDate(new Date()).replaceAll('.', '-');
              if (draftDate && draftDate < today) {
                setMinDate(today);
                setDraftDate('');
                setMonth(today.slice(0, 7));
                return;
              }
              setDate(draftDate);
              onDateChange?.(draftDate);
              setTimeSlot(draftTime);
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            {draftDate ? dateLabel(draftDate) + ' ' : ''}
            {!dateOnly && timeSlotLabels[draftTime]} 선택
          </button>
        </PickerLayer>
      )}
    </div>
  );
}

function PickerLayer({
  id,
  title,
  presentation,
  onClose,
  children,
}: {
  id: string;
  title: string;
  presentation: 'popover' | 'modal';
  onClose: () => void;
  children: ReactNode;
}) {
  if (presentation === 'modal') {
    return (
      <Modal
        open
        title={title}
        onClose={onClose}
        className={pickerStyles.modal}
      >
        <div id={id} className={`${styles.calendar} ${pickerStyles.calendar}`}>
          {children}
        </div>
      </Modal>
    );
  }

  return (
    <div id={id} role="dialog" aria-label={title} className={styles.calendar}>
      {children}
    </div>
  );
}
