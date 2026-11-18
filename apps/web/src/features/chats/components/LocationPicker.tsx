'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { RegionLabel } from '@/constants/enum-labels';
import { Region } from '@snappick/shared';
import styles from './InquiryForm.module.css';

const regions = Object.values(Region);

export default function LocationPicker() {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<{
    region: Region | '';
    detail: string;
  }>({ region: '', detail: '' });
  const [region, setRegion] = useState<Region | ''>('');
  const [detail, setDetail] = useState('');
  const value = [
    selection.region && RegionLabel[selection.region],
    selection.detail,
  ]
    .filter(Boolean)
    .join(' ');

  function confirmSelection() {
    setSelection({
      region,
      detail: detail.trim(),
    });
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return (
    <div
      ref={root}
      className={styles.schedule}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <input type="hidden" name="region" value={selection.region} />
      <input type="hidden" name="location" value={selection.detail} />
      <button
        ref={trigger}
        type="button"
        className={styles.scheduleTrigger}
        aria-label="촬영 장소"
        aria-expanded={open}
        aria-controls={id}
        data-empty={!value}
        onClick={() => {
          setRegion(selection.region);
          setDetail(selection.detail);
          setOpen(!open);
        }}
      >
        {value || '예) 서울숲, 제주'}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="촬영 장소 선택"
          className={`${styles.calendar} ${styles.locationPopup}`}
        >
          <fieldset className={styles.choices}>
            <legend>지역</legend>
            <div className={styles.chips}>
              {regions.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={region === value}
                  onClick={() => setRegion(region === value ? '' : value)}
                >
                  {RegionLabel[value]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className={styles.field}>
            <label htmlFor={`${id}-detail`}>상세 장소 (선택)</label>
            <input
              id={`${id}-detail`}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  confirmSelection();
                }
              }}
              maxLength={50}
              placeholder="예) 서울숲, 성수동"
            />
          </div>
          <button
            type="button"
            className={styles.selectSchedule}
            onClick={confirmSelection}
          >
            선택 완료
          </button>
        </div>
      )}
    </div>
  );
}
