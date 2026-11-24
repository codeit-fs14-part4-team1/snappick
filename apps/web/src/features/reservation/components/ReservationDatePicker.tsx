'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { formatDate, formatDateWithWeekday } from '@/utils/dateTime';

import styles from './ReservationDatePicker.module.css';

type ReservationDatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 한국 시간 기준 오늘 날짜를 YYYY.MM.DD 형식으로 반환
function getTodayKst() {
  return formatDate(new Date());
}

// YYYY.MM.DD 형식의 날짜를 YYYY-MM-DD 형식으로 변환
function toIsoDate(value: string) {
  return value.replaceAll('.', '-');
}

// 예약 관련 날짜를 달력에서 선택
export default function ReservationDatePicker({
  id,
  value,
  onChange,
  placeholder = 'YYYY.MM.DD',
  disabled = false,
  invalid = false,
  ariaLabel = '날짜 선택',
}: ReservationDatePickerProps) {
  const pickerId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState('');

  const today = getTodayKst();
  const todayMonth = today.slice(0, 7);

  const [month, setMonth] = useState(() =>
    (value || getTodayKst()).slice(0, 7),
  );

  const [year, monthNumber] = month.split('.').map(Number);

  // 해당 월의 첫 번째 요일
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();

  // 해당 월의 전체 일수
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  const canConfirm = !disabled && Boolean(draftDate) && draftDate >= today;

  // 달력 외부를 클릭하면 선택 영역 닫기
  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }

    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isOpen, disabled]);

  // 이전 달 또는 다음 달로 이동
  const moveMonth = (delta: number) => {
    const nextMonth = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
      .toISOString()
      .slice(0, 7)
      .replace('-', '.');

    if (nextMonth < todayMonth) {
      return;
    }

    setMonth(nextMonth);
  };

  // 달력 열기 및 기존 선택 날짜 반영
  const handleToggle = () => {
    if (disabled) {
      return;
    }

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const currentDate = getTodayKst();

    setDraftDate(value);

    // 기존 날짜가 만료된 경우에는 현재 월부터 표시
    setMonth(
      value && value >= currentDate
        ? value.slice(0, 7)
        : currentDate.slice(0, 7),
    );

    setIsOpen(true);
  };

  // 선택한 날짜를 최종 확정
  const handleConfirm = () => {
    if (!canConfirm || draftDate < getTodayKst()) {
      return;
    }

    onChange(draftDate);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          event.stopPropagation();

          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      {/* 날짜 선택 입력 버튼 */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={styles.trigger}
        aria-label={value ? `${ariaLabel}: ${value}` : ariaLabel}
        aria-expanded={isOpen && !disabled}
        aria-haspopup="dialog"
        aria-controls={isOpen && !disabled ? pickerId : undefined}
        data-invalid={invalid}
        data-empty={!value}
        disabled={disabled}
        onClick={handleToggle}
      >
        <span>
          {value
            ? formatDateWithWeekday(toIsoDate(value)) || value
            : placeholder}
        </span>

        {/* 달력 아이콘 */}
        <svg
          className={styles.calendarIcon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>

      {/* 날짜 선택 달력 */}
      {isOpen && !disabled && (
        <div
          id={pickerId}
          className={styles.calendar}
          role="dialog"
          aria-label={ariaLabel}
        >
          {/* 연도 및 월 이동 */}
          <div className={styles.month}>
            <button
              type="button"
              className={styles.monthButton}
              aria-label="이전 달"
              disabled={month <= todayMonth}
              onClick={() => moveMonth(-1)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <strong className={styles.monthTitle} aria-live="polite">
              {year}년 {monthNumber}월
            </strong>

            <button
              type="button"
              className={styles.monthButton}
              aria-label="다음 달"
              onClick={() => moveMonth(1)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* 요일 및 날짜 목록 */}
          <div className={styles.days}>
            {WEEKDAYS.map((day) => (
              <span key={day} className={styles.weekday}>
                {day}
              </span>
            ))}

            {/* 해당 월의 시작 요일 이전 빈칸 */}
            {Array.from({ length: firstDay }, (_, index) => (
              <span key={`blank-${index}`} aria-hidden="true" />
            ))}

            {/* 날짜별 선택 버튼 */}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;

              const date = `${month}.${String(day).padStart(2, '0')}`;

              const isPast = date < today;
              const isSelected = draftDate === date;

              return (
                <button
                  key={date}
                  type="button"
                  className={styles.dayButton}
                  aria-label={`${year}년 ${monthNumber}월 ${day}일`}
                  aria-pressed={isSelected}
                  aria-current={date === today ? 'date' : undefined}
                  disabled={isPast}
                  onClick={() => setDraftDate(date)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* 날짜 선택 확정 버튼 */}
          <button
            type="button"
            className={styles.confirmButton}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {draftDate
              ? `${formatDateWithWeekday(toIsoDate(draftDate))} 선택`
              : '날짜 선택'}
          </button>
        </div>
      )}
    </div>
  );
}
