import { type SubmitEvent, useState } from 'react';
import styles from './SearchBar.module.css';

type SearchBarProps = {
  initialKeyword: string;
  maxLength: number;
  onSubmit: (keyword: string) => void;
};

export default function SearchBar({
  initialKeyword,
  maxLength,
  onSubmit,
}: SearchBarProps) {
  //입력 중인 값
  const [text, setText] = useState(initialKeyword);
  //Enter(제출) 시 확정
  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (text.trim() === initialKeyword) return;
    onSubmit(text);
  }

  return (
    <form className={styles.search} role="search" onSubmit={handleSubmit}>
      <span className={styles.icon} aria-hidden="true" />
      <input
        type="search"
        className={styles.input}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={maxLength}
        placeholder="작가 활동명, 사진 설명, 키워드로 검색해 보세요"
        aria-label="사진 검색"
      />
    </form>
  );
}
