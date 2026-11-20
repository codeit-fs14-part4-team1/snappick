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

//가운데 미리보기: 사진을 고르면 바로 보인다
//name: 대체 텍스트 (목록 썸네일과 같은 이름)
//fileName·fileSize는 업로드에만 있음 (관리는 서버에 원본 정보가 없어 생략 → 정보 줄 숨김)
export type EditorPreview = {
  previewUrl: string;
  name: string;
  fileName?: string;
  fileSize?: number;
  isRepresentative: boolean;
};

type PhotoEditorProps = {
  //왼쪽 목록
  photos: PhotoListItem[];
  selectedId: string | null;
  onSelect: (localId: string) => void;
  onRemove: (localId: string) => void;
  //목록 끝 더 불러오기 (관리 모달만)
  loadMore?: PhotoListLoadMore;

  //선택한 사진: 미리보기는 고르면 바로, 폼은 정보가 있을 때만
  //(관리 모달은 상세를 불러오는 동안 detail이 null → 폼 자리에 안내, 레이아웃 유지)
  preview: EditorPreview | null;
  detail: PhotoDetail | null;
  detailError?: boolean;
  onRepresentativeChange: (on: boolean) => void;
  //입력 규칙(토글·키워드 검증)은 여기서 처리하고, 바뀐 결과만 올려 보낸다
  onChange: (patch: Partial<PhotoDetail>) => void;

  //하단: onPrev가 없으면 이전 버튼 숨김 (관리 모달)
  onPrev?: () => void;
  onSubmit: () => void;
  submitLabel: string;
  //버튼 · 오버레이에 같이 쓴다
  submittingLabel: string;
  //모든 사진에 필수 정보가 채워지기 전·등록 중에는 막는다
  submitDisabled: boolean;
  isSubmitting: boolean;
};

//있으면 빼고 없으면 넣는다
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

//2단계 정보 입력 (업로드·관리 모달 공통): 사진 목록 | 미리보기 | 정보 폼 + 이전/등록하기
//태블릿·모바일은 세로로 쌓임, 등록 중엔 inert + 오버레이로 전부 막음
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
  //키워드 규칙 위반 안내 (선택한 사진 폼에만 보인다)
  const [keywordError, setKeywordError] = useState<string | null>(null);

  //사진이 바뀌면 이전 사진의 안내를 지운다
  const handleSelect = (localId: string) => {
    setKeywordError(null);
    onSelect(localId);
  };
  const handleRemove = (localId: string) => {
    setKeywordError(null);
    onRemove(localId);
  };

  //추가했으면 true (폼이 입력창을 비움), 규칙에 안 맞으면 안내를 띄우고 false
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
          //사진을 바꾸면 입력 중이던 키워드를 비우도록 사진마다 새로 그린다
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

        {/* 정보를 불러오는 동안 폼 자리를 비워 두지 않는다 (미리보기·목록이 출렁이지 않게) */}
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
