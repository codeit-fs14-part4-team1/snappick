'use client';

import { useId, useRef, useState } from 'react';
import { Category, Region, Style } from '@snappick/shared';
import Button from '@/components/ui/Button';
import type { InquiryPayload } from '../types';
import { CategoryLabel, StyleLabel } from '@/constants/enum-labels';
import styles from './InquiryForm.module.css';
import SchedulePicker from './SchedulePicker';
import type { InquiryTimeSlot } from './SchedulePicker';
import LocationPicker from './LocationPicker';

type Props = {
  referenceDate: string;
  onSubmit: (value: InquiryPayload) => void | Promise<void>;
  onSkip: () => void;
};

export function InquiryPrompt({
  onResume,
  disabled,
}: {
  onResume: () => void;
  disabled: boolean;
}) {
  return (
    <div className={styles.resume}>
      <div>
        <h3 className={styles.resumeTitle}>촬영 정보를 건너뛰었어요</h3>
        <p className={styles.resumeDescription}>
          촬영 정보를 남겨주시면 더 정확하게 상담할 수 있어요.
        </p>
      </div>
      <Button
        variant="outline"
        fullWidth
        onClick={onResume}
        disabled={disabled}
      >
        촬영 정보 작성하기
      </Button>
    </div>
  );
}

export default function InquiryForm({
  referenceDate,
  onSubmit,
  onSkip,
}: Props) {
  const id = useId();
  const [concept, setConcept] = useState<Style[]>([]);
  const [category, setCategory] = useState<Category>();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function toggle(value: Style) {
    if (concept.includes(value)) {
      setConcept(concept.filter((item) => item !== value));
    } else if (concept.length < 5) {
      setConcept([...concept, value]);
    } else {
      setError('스타일은 최대 5개까지 선택할 수 있어요.');
      return;
    }
    setError('');
  }

  return (
    <form
      className={styles.card}
      aria-labelledby={`${id}-title`}
      aria-busy={pending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        const data = new FormData(event.currentTarget);
        const date = String(data.get('date') ?? '');
        const regionValue = String(data.get('region') ?? '');
        const region = Object.values(Region).find(
          (value) => value === regionValue,
        );
        const location = String(data.get('location') ?? '').trim();
        const timeSlot = String(
          data.get('timeSlot') ?? 'UNDECIDED',
        ) as InquiryTimeSlot;
        if (
          !date &&
          !region &&
          !location &&
          timeSlot === 'UNDECIDED' &&
          !concept.length &&
          !category
        ) {
          setError('촬영 정보를 한 가지 이상 입력해 주세요.');
          return;
        }
        setError('');
        setPending(true);
        submitting.current = true;
        try {
          await onSubmit({
            ...(date && { date }),
            ...(timeSlot !== 'UNDECIDED' && { timeSlot }),
            ...(region && { region }),
            ...(location && { location }),
            ...(concept.length && { concept }),
            ...(category && { category }),
          });
        } catch {
          setError('촬영 정보를 보내지 못했어요. 다시 시도해 주세요.');
        } finally {
          setPending(false);
          submitting.current = false;
        }
      }}
    >
      <header>
        <h3 id={`${id}-title`}>촬영 정보</h3>
        <p>아는 만큼만 적어 주세요. 비워 둔 항목은 채팅으로 이야기하면 돼요.</p>
      </header>
      <fieldset disabled={pending} className={styles.fields}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>촬영 일정</span>
          <SchedulePicker referenceDate={referenceDate} />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>촬영 장소</span>
          <LocationPicker />
        </div>
        <fieldset className={styles.choices}>
          <legend>콘셉트·스타일 (여러 개 선택)</legend>
          <div className={styles.chips}>
            {Object.values(Style).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={concept.includes(value)}
                onClick={() => toggle(value)}
              >
                {StyleLabel[value]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.choices}>
          <legend>촬영 목적·카테고리</legend>
          <div className={styles.chips}>
            {Object.values(Category).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() =>
                  setCategory(category === value ? undefined : value)
                }
              >
                {CategoryLabel[value]}
              </button>
            ))}
          </div>
        </fieldset>
      </fieldset>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" disabled={pending} onClick={onSkip}>
          건너뛰고 대화하기
        </button>
        <button type="submit" disabled={pending}>
          {pending ? '보내는 중…' : '문의 보내기'}
        </button>
      </div>
    </form>
  );
}
