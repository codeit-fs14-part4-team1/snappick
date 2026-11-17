'use client';

import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Category, Style } from '@snappick/shared';
import { CategoryLabel, StyleLabel } from '@/constants/enum-labels';
import styles from './PhotoMetadataForm.module.css';

//시안 순서
const CATEGORY_ORDER: Category[] = [
  Category.WEDDING,
  Category.FRIENDS,
  Category.COUPLE,
  Category.FAMILY,
  Category.PROFILE,
  Category.GRADUATION,
  Category.EVENT,
  Category.PET,
  Category.ETC,
];

const STYLE_ORDER: Style[] = [
  Style.NATURAL,
  Style.BRIGHT,
  Style.FILM,
  Style.VINTAGE,
  Style.MONOCHROME,
  Style.CINEMATIC,
  Style.DREAMY,
  Style.MINIMAL,
];

//서버 규칙과 같은 값 (apps/api photo-info.ts)
export const MAX_STYLES = 3;
export const MAX_KEYWORDS = 5;
export const MAX_KEYWORD_LENGTH = 10; //서버처럼 String.length로 센다
export const MAX_DESCRIPTION_LENGTH = 50;

type PhotoMetadataFormProps = {
  categories: Category[];
  onToggleCategory: (category: Category) => void;
  styles: Style[];
  onToggleStyle: (style: Style) => void;
  keywords: string[];
  //입력한 키워드를 받는다. 추가했으면 true (입력창을 비운다), 규칙에 안 맞으면 false
  onKeywordSubmit: (keyword: string) => boolean;
  onKeywordRemove: (keyword: string) => void;
  //키워드 규칙 위반 안내 (있으면 입력창 빨간 테두리)
  keywordError: string | null;
  description: string;
  onDescriptionChange: (description: string) => void;
};

// 2단계 오른쪽: 촬영 카테고리(필수) / 스타일 태그(최대 3) / 자유 키워드(최대 5) / 한 줄 설명
export default function PhotoMetadataForm({
  categories,
  onToggleCategory,
  styles: selectedStyles,
  onToggleStyle,
  keywords,
  onKeywordSubmit,
  onKeywordRemove,
  keywordError,
  description,
  onDescriptionChange,
}: PhotoMetadataFormProps) {
  const id = useId();
  //입력 중인 키워드 (이 폼 안에서만 쓰는 값)
  const [draft, setDraft] = useState('');
  const styleFull = selectedStyles.length >= MAX_STYLES;

  const submitDraft = () => {
    if (draft === '') return;
    if (onKeywordSubmit(draft)) setDraft('');
  };

  const handleKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    //한글 조합 중 Enter는 글자 확정용이라 무시
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      submitDraft();
    }
    //빈 입력창에서 Backspace: 마지막 키워드 빼기
    if (event.key === 'Backspace' && draft === '' && keywords.length > 0) {
      onKeywordRemove(keywords[keywords.length - 1]);
    }
  };

  return (
    <div className={styles.form}>
      <div
        className={styles.field}
        role="group"
        aria-labelledby={`${id}-category`}
      >
        <p id={`${id}-category`} className={styles.label}>
          촬영 카테고리
          <span className={styles.required}>필수 · 여러 개 선택</span>
        </p>
        <div className={styles.chips}>
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              className={styles.chip}
              aria-pressed={categories.includes(category)}
              onClick={() => onToggleCategory(category)}
            >
              {CategoryLabel[category]}
            </button>
          ))}
        </div>
      </div>

      <div
        className={styles.field}
        role="group"
        aria-labelledby={`${id}-style`}
      >
        <p id={`${id}-style`} className={styles.label}>
          스타일 태그
          <span className={styles.meta}>
            최대 {MAX_STYLES}개 · {selectedStyles.length}/{MAX_STYLES}
          </span>
        </p>
        <div className={styles.chips}>
          {STYLE_ORDER.map((style) => {
            const selected = selectedStyles.includes(style);
            return (
              <button
                key={style}
                type="button"
                className={styles.chip}
                aria-pressed={selected}
                //3개를 고르면 나머지는 못 고른다 (고른 것은 풀 수 있음)
                disabled={styleFull && !selected}
                onClick={() => onToggleStyle(style)}
              >
                #{StyleLabel[style]}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-keyword`}>
          자유 키워드
          <span className={styles.meta}>
            최대 {MAX_KEYWORDS}개 · 키워드당 {MAX_KEYWORD_LENGTH}자 · 띄어쓰기
            없이
          </span>
        </label>
        <div
          className={styles.keywordBox}
          data-error={keywordError ? true : undefined}
        >
          {keywords.map((keyword) => (
            <span key={keyword} className={styles.keyword}>
              {keyword}
              <button
                type="button"
                className={styles.keywordRemove}
                aria-label={`${keyword} 키워드 빼기`}
                onClick={() => onKeywordRemove(keyword)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </span>
          ))}
          {keywords.length < MAX_KEYWORDS && (
            <input
              id={`${id}-keyword`}
              className={styles.keywordInput}
              value={draft}
              placeholder={keywords.length === 0 ? '입력 후 Enter' : undefined}
              aria-invalid={keywordError ? true : undefined}
              aria-describedby={
                keywordError ? `${id}-keyword-error` : undefined
              }
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
            />
          )}
        </div>
        {keywordError && (
          <p id={`${id}-keyword-error`} className={styles.error} role="alert">
            {keywordError}
          </p>
        )}
      </div>

      <div className={styles.descriptionField}>
        <label className={styles.label} htmlFor={`${id}-description`}>
          한 줄 설명
        </label>
        <input
          id={`${id}-description`}
          className={styles.textInput}
          value={description}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="사진을 한 줄로 소개해 주세요"
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
    </div>
  );
}
