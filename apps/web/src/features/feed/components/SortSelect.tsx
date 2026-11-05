import { useId, useRef, useState } from 'react';
import styles from './SortSelect.module.css';
import { TabItem } from '@/components/ui/Tabs';
import { usePopover } from '@/hooks/usePopover';

type SortSelectProps = {
  items: TabItem[];
  value: string;
  onValueChange: (sort: string) => void;
};
export default function SortSelect({
  items,
  value,
  onValueChange,
}: SortSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = items.find((item) => item.value === value)?.label;
  const panelId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { closeAndRestoreFocus } = usePopover({
    isOpen,
    onClose: () => setIsOpen(false),
    containerRef,
    panelRef,
    triggerRef,
  });

  function selectItem(nextValue: string) {
    if (nextValue !== value) onValueChange(nextValue);
    closeAndRestoreFocus();
  }

  return (
    <div className={styles.select} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {selectedLabel}
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          id={panelId}
          className={styles.menu}
          aria-label="정렬 기준"
          ref={panelRef}
        >
          {items.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={item.value === value}
                onClick={() => selectItem(item.value)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
