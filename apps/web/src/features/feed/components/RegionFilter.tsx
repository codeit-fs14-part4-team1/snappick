import Button from '@/components/ui/Button';
import styles from './RegionFilter.module.css';
import { useId, useRef, useState } from 'react';
import { TabItem } from '@/components/ui/Tabs';
import { usePopover } from '@/hooks/usePopover';

type RegionFilterProps = {
  items: TabItem[];
  values: string[];
  onApply: (regions: string[]) => void;
};

export default function RegionFilter({
  items,
  values,
  onApply,
}: RegionFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(values);
  const panelId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { closeAndRestoreFocus } = usePopover({
    isOpen,
    onClose: () => setIsOpen(false),
    containerRef,
    panelRef,
    triggerRef,
  });

  const firstLabel = items.find((item) => item.value === values[0])?.label;
  let buttonLabel = '전체 지역';
  if (values.length === 1) buttonLabel = `${firstLabel}`;
  if (values.length > 1) buttonLabel = `${firstLabel} 외 ${values.length - 1}`;

  function toggleDraft(value: string) {
    setDraft(
      draft.includes(value)
        ? draft.filter((item) => item !== value)
        : [...draft, value],
    );
  }
  function resetDraft() {
    setDraft([]);
  }

  return (
    <div className={styles.filter} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-active={values.length > 0}
        onClick={() => {
          if (!isOpen) setDraft(values);
          setIsOpen(!isOpen);
        }}
      >
        {buttonLabel}
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen && (
        <div id={panelId} className={styles.panel} ref={panelRef}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.title}>작가 활동 지역</legend>
            <div className={styles.options}>
              {items.map((item) => (
                <label key={item.value} className={styles.option}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={draft.includes(item.value)}
                    onChange={() => toggleDraft(item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.actions}>
            <button type="button" className={styles.reset} onClick={resetDraft}>
              초기화
            </button>
            <Button
              size="sm"
              onClick={() => {
                function isSameRegions(a: string[], b: string[]) {
                  return (
                    a.length === b.length &&
                    a.every((value) => b.includes(value))
                  );
                }
                if (!isSameRegions(draft, values)) onApply(draft);
                closeAndRestoreFocus();
              }}
            >
              적용
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
