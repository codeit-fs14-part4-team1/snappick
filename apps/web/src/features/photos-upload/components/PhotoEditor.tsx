'use client';

import { useState } from 'react';
import type { Category, Style } from '@snappick/shared';
import Button from '@/components/ui/Button';
import type { PhotoDetail } from '../types';
import PhotoList from './PhotoList';
import type { PhotoListItem } from './PhotoList';
import PhotoPreview from './PhotoPreview';
import PhotoMetadataForm, {
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
} from './PhotoMetadataForm';
import styles from './PhotoEditor.module.css';

//오른쪽에서 편집 중인 사진 한 장의 정보
export type EditorPhoto = PhotoDetail & {
  previewUrl: string;
  fileName: string;
  fileSize: number;
  isRepresentative: boolean;
};

type PhotoEditorProps = {
  //왼쪽 목록
  photos: PhotoListItem[];
  selectedId: string | null;
  onSelect: (localId: string) => void;
  onRemove: (localId: string) => void;

  //선택한 사진 (가운데 미리보기 + 오른쪽 폼)
  current: EditorPhoto | null;
  onRepresentativeChange: (on: boolean) => void;
  //입력 규칙(토글·키워드 검증)은 여기서 처리하고, 바뀐 결과만 올려 보낸다
  onChange: (patch: Partial<PhotoDetail>) => void;

  //하단
  onPrev: () => void;
  onSubmit: () => void;
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
  current,
  onRepresentativeChange,
  onChange,
  onPrev,
  onSubmit,
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
    if (!current) return false;
    const keyword = input.trim();
    if (keyword === '') return false;

    let error: string | null = null;
    if (/\s/.test(keyword)) error = '띄어쓰기 없이 입력해 주세요.';
    else if (keyword.length > MAX_KEYWORD_LENGTH)
      error = `키워드는 ${MAX_KEYWORD_LENGTH}자까지 입력할 수 있어요.`;
    else if (current.keywords.includes(keyword))
      error = '이미 추가한 키워드예요.';
    else if (current.keywords.length >= MAX_KEYWORDS)
      error = `키워드는 ${MAX_KEYWORDS}개까지 넣을 수 있어요.`;

    setKeywordError(error);
    if (error) return false;
    onChange({ keywords: [...current.keywords, keyword] });
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
        />

        {current && (
          <>
            <PhotoPreview
              previewUrl={current.previewUrl}
              fileName={current.fileName}
              fileSize={current.fileSize}
              isRepresentative={current.isRepresentative}
              onRepresentativeChange={onRepresentativeChange}
            />
            {/* 사진을 바꾸면 입력 중이던 키워드를 비우도록 사진마다 새로 그린다 */}
            <PhotoMetadataForm
              key={selectedId}
              categories={current.categories}
              onToggleCategory={(category: Category) =>
                onChange({ categories: toggle(current.categories, category) })
              }
              styles={current.styles}
              onToggleStyle={(style: Style) =>
                onChange({ styles: toggle(current.styles, style) })
              }
              keywords={current.keywords}
              onKeywordSubmit={submitKeyword}
              onKeywordRemove={(keyword) => {
                setKeywordError(null);
                onChange({
                  keywords: current.keywords.filter((k) => k !== keyword),
                });
              }}
              keywordError={keywordError}
              description={current.description}
              onDescriptionChange={(description) => onChange({ description })}
            />
          </>
        )}
      </div>

      <div className={styles.footer} inert={isSubmitting}>
        <Button variant="outline" size="md" onClick={onPrev}>
          이전
        </Button>
        <Button
          size="md"
          disabled={submitDisabled || isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? '등록 중…' : `${photos.length}장 등록하기`}
        </Button>
      </div>

      {isSubmitting && (
        <div className={styles.overlay} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          등록중입니다...
        </div>
      )}
    </div>
  );
}
