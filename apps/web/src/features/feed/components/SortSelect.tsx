import { useState } from 'react';
import styles from './SortSelect.module.css';
import { TabItem } from '@/components/ui/Tabs';

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

  function selectItem(nextValue: string) {
    if (nextValue !== value) onValueChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className={styles.select}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {selectedLabel}
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen && (
        <ul className={styles.menu} aria-label="정렬 기준">
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
