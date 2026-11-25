'use client';

import { useId, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Chip from '@/components/ui/Chip';
import { RegionLabel } from '@/constants/enum-labels';
import { Region } from '@snappick/shared';
import styles from './InquiryForm.module.css';
import pickerStyles from './LocationPicker.module.css';

const regions = Object.values(Region);

export default function LocationPicker() {
  const id = useId();
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

  return (
    <div className={styles.schedule}>
      <input type="hidden" name="region" value={selection.region} />
      <input type="hidden" name="location" value={selection.detail} />
      <button
        ref={trigger}
        type="button"
        className={styles.scheduleTrigger}
        aria-label="촬영 장소"
        aria-expanded={open}
        aria-haspopup="dialog"
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
        <Modal
          open={open}
          title="촬영 장소 선택"
          onClose={() => setOpen(false)}
          className={pickerStyles.modal}
        >
          <div id={id} className={pickerStyles.content}>
            <fieldset className={styles.choices}>
              <legend>지역</legend>
              <div className={styles.chips}>
                {regions.map((value) => (
                  <Chip
                    key={value}
                    aria-pressed={region === value}
                    onClick={() => setRegion(region === value ? '' : value)}
                  >
                    {RegionLabel[value]}
                  </Chip>
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
        </Modal>
      )}
    </div>
  );
}
