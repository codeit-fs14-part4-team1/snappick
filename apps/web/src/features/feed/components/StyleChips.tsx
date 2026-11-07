import styles from './StyleChips.module.css';
import { TabItem } from '@/components/ui/Tabs';

type StyleChipsProps = {
  items: TabItem[];
  selectedValues: string[];
  onToggle: (style: string) => void;
};

export default function StyleChips({
  items,
  selectedValues,
  onToggle,
}: StyleChipsProps) {
  return (
    <ul className={styles.chips} aria-label="스타일">
      {items.map((item) => (
        <li key={item.value} className={styles.item}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={selectedValues.includes(item.value)}
            onClick={() => onToggle(item.value)}
          >
            #{item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
