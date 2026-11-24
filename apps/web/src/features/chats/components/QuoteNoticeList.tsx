import styles from './QuoteNoticeList.module.css';

export default function QuoteNoticeList({ text }: { text: string }) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[·•]\s*|[-*]\s+)/, ''))
    .filter(Boolean);

  return (
    <ul className={styles.list}>
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}
