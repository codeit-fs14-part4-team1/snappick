'use client';

import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { formatQuoteDate, formatQuoteTime } from '../quote';
import styles from './TimePicker.module.css';

type Props = {
  value: string;
  date?: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
};

export default function TimePicker({
  value,
  date,
  onValueChange,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || '09:00');
  const trigger = useRef<HTMLButtonElement>(null);
  const [hour, minute] = draft.split(':').map(Number);
  const afternoon = hour >= 12;
  const displayHour = hour % 12 || 12;

  function select(
    nextHour: number,
    nextMinute: number,
    nextAfternoon = afternoon,
  ) {
    setDraft(
      `${String((nextHour % 12) + (nextAfternoon ? 12 : 0)).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`,
    );
  }

  function close() {
    setOpen(false);
    requestAnimationFrame(() =>
      trigger.current?.focus({ preventScroll: true }),
    );
  }

  return (
    <>
      <input type="hidden" name="startTime" value={value} />
      <button
        ref={trigger}
        type="button"
        className={[styles.trigger, triggerClassName].filter(Boolean).join(' ')}
        aria-label="촬영 시작 시간"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-empty={!value}
        onClick={() => {
          setDraft(value || '09:00');
          setOpen(true);
        }}
      >
        {value ? formatQuoteTime(value) : '촬영 시작 시간을 선택해 주세요'}
      </button>
      {open && (
        <div
          className={styles.layer}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <Modal
            open
            title="촬영 시작 시간"
            onClose={close}
            className={styles.modal}
            footer={
              <>
                <Button variant="outline" onClick={close}>
                  취소
                </Button>
                <Button
                  onClick={() => {
                    onValueChange(draft);
                    close();
                  }}
                >
                  선택 완료
                </Button>
              </>
            }
          >
            {date && <p className={styles.date}>{formatQuoteDate(date)}</p>}
            <div className={styles.content}>
              <output className={styles.preview} aria-live="polite">
                {formatQuoteTime(draft)}
              </output>
              <div
                className={styles.period}
                role="group"
                aria-label="오전·오후"
              >
                {[false, true].map((pm) => (
                  <button
                    key={String(pm)}
                    type="button"
                    aria-pressed={afternoon === pm}
                    onClick={() => select(displayHour, minute, pm)}
                  >
                    {pm ? '오후' : '오전'}
                  </button>
                ))}
              </div>
              <div className={styles.section} role="group" aria-label="시 선택">
                <span className={styles.label}>시</span>
                <div className={styles.hours}>
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((number) => (
                    <button
                      key={number}
                      type="button"
                      aria-pressed={displayHour === number}
                      onClick={() => select(number, minute)}
                    >
                      {number}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.section} role="group" aria-label="분 선택">
                <span className={styles.label}>분</span>
                <div className={styles.minutes}>
                  {[...new Set([0, 30, minute])]
                    .sort((a, b) => a - b)
                    .map((number) => (
                      <button
                        key={number}
                        type="button"
                        aria-pressed={minute === number}
                        onClick={() => select(displayHour, number)}
                      >
                        {String(number).padStart(2, '0')}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </>
  );
}
