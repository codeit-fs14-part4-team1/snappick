'use client';

import { useState } from 'react';
import type { Category, Style } from '@snappick/shared';
import Button from '@/components/ui/Button';
import type { PhotoDetail } from '../types';
import PhotoList from './PhotoList';
import type { PhotoListItem, PhotoListLoadMore } from './PhotoList';
import PhotoPreview from './PhotoPreview';
import PhotoMetadataForm, {
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
} from './PhotoMetadataForm';
import styles from './PhotoEditor.module.css';

//미리보기 (fileName · fileSize는 업로드시에만 사용)
export type EditorPreview = {
  previewUrl: string;
  name: string;
  fileName?: string;
  fileSize?: number;
  isRepresentative: boolean;
};

type PhotoEditorProps = {
  //왼쪽 썸네일 목록
  photos: PhotoListItem[];
  selectedId: string | null;
  onSelect: (localId: string) => void;
  onRemove: (localId: string) => void;
  //무한스크롤 (사진 관리만 사용)
  loadMore?: PhotoListLoadMore;

  //선택한 사진 (관리 모달은 불러오는 동안 detail null)
  preview: EditorPreview | null;
  detail: PhotoDetail | null;
  detailError?: boolean;
  onRepresentativeChange: (on: boolean) => void;
  onChange: (patch: Partial<PhotoDetail>) => void;

  //하단 버튼 (사진 관리는 이전 버튼 숨김)
  onPrev?: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submittingLabel: string;
  submitDisabled: boolean;
  isSubmitting: boolean;
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

//정보 입력 (업로드 · 사진 관리 공통): 썸네일 목록 | 미리보기 | 폼 + 하단 버튼
export default function PhotoEditor({
  photos,
  selectedId,
  onSelect,
  onRemove,
  loadMore,
  preview,
  detail,
  detailError = false,
  onRepresentativeChange,
  onChange,
  onPrev,
  onSubmit,
  submitLabel,
  submittingLabel,
  submitDisabled,
  isSubmitting,
}: PhotoEditorProps) {
  const [keywordError, setKeywordError] = useState<string | null>(null);

  const handleSelect = (localId: string) => {
    setKeywordError(null);
    onSelect(localId);
  };
  const handleRemove = (localId: string) => {
    setKeywordError(null);
    onRemove(localId);
  };

  //키워드 추가
  const submitKeyword = (input: string): boolean => {
    if (!detail) return false;
    const keyword = input.trim();
    if (keyword === '') return false;

    let error: string | null = null;
    if (/\s/.test(keyword)) error = '띄어쓰기 없이 입력해 주세요.';
    else if (keyword.length > MAX_KEYWORD_LENGTH)
      error = `키워드는 ${MAX_KEYWORD_LENGTH}자까지 입력할 수 있어요.`;
    else if (detail.keywords.includes(keyword))
      error = '이미 추가한 키워드예요.';
    else if (detail.keywords.length >= MAX_KEYWORDS)
      error = `키워드는 ${MAX_KEYWORDS}개까지 넣을 수 있어요.`;

    setKeywordError(error);
    if (error) return false;
    onChange({ keywords: [...detail.keywords, keyword] });
    return true;
  };

  return (
    <div className={styles.editor}>
      <div className={styles.body} inert={isSubmitting}>
        <PhotoList
          photos={photos}
          selectedId={selectedId}
          onSelect={handleSelect}
          onRemove={handleRemove}
          loadMore={loadMore}
        />

        {preview && (
          <PhotoPreview
            previewUrl={preview.previewUrl}
            name={preview.name}
            fileName={preview.fileName}
            fileSize={preview.fileSize}
            isRepresentative={preview.isRepresentative}
            onRepresentativeChange={onRepresentativeChange}
          />
        )}

        {preview && detail && (
          //사진마다 새로 그려서 입력 중 키워드 비움
          <PhotoMetadataForm
            key={selectedId}
            categories={detail.categories}
            onToggleCategory={(category: Category) =>
              onChange({ categories: toggle(detail.categories, category) })
            }
            styles={detail.styles}
            onToggleStyle={(style: Style) =>
              onChange({ styles: toggle(detail.styles, style) })
            }
            keywords={detail.keywords}
            onKeywordSubmit={submitKeyword}
            onKeywordRemove={(keyword) => {
              setKeywordError(null);
              onChange({
                keywords: detail.keywords.filter((k) => k !== keyword),
              });
            }}
            keywordError={keywordError}
            description={detail.description}
            onDescriptionChange={(description) => onChange({ description })}
          />
        )}

        {/* 불러오는 중 · 에러 (폼 자리 유지) */}
        {preview && !detail && (
          <div
            className={styles.formPlaceholder}
            role={detailError ? 'alert' : 'status'}
          >
            {detailError
              ? '사진 정보를 불러오지 못했어요. 다른 사진을 골랐다가 다시 골라 주세요.'
              : '사진 정보를 불러오는 중이에요…'}
          </div>
        )}
      </div>

      <div className={styles.footer} inert={isSubmitting}>
        {onPrev && (
          <Button variant="outline" size="md" onClick={onPrev}>
            이전
          </Button>
        )}
        <Button
          size="md"
          disabled={submitDisabled || isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>

      {isSubmitting && (
        <div className={styles.overlay} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          {submittingLabel}
        </div>
      )}
    </div>
  );
}
