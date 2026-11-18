'use client';

import { useEffect, useId, useRef } from 'react';
import type { ChangeEvent } from 'react';
import Button from '@/components/ui/Button';
import UploadQueue from './UploadQueue';
import type { UploadQueuePhoto } from './UploadQueue';
import { MAX_PHOTOS } from '../validation';
import styles from './PhotoUploader.module.css';

type PhotoUploaderProps = {
  policyAgreed: boolean;
  onPolicyAgreedChange: (agreed: boolean) => void;
  //동의 없이 다음을 누르면 true → 체크박스 아래 안내 + 체크박스로 포커스
  policyError: boolean;
  //파일 선택 결과 (검증·전처리·업로드는 받는 쪽에서)
  onFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  //검증에서 빠진 파일 안내 (예: "IMG_2101.heic는 … 올리지 않았어요.")
  rejectMessages: string[];
  //아래 세 개는 목록(UploadQueue)으로 그대로 넘긴다
  photos: UploadQueuePhoto[];
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  onRetryAll: () => void;
  onCancel: () => void;
  onNext: () => void;
  nextDisabled: boolean;
};

const POLICIES = [
  '고객이 나온 사진은 고객이 공개에 동의한 경우에만 올릴 수 있어요.',
  '올린 사진은 탐색 화면과 작가 프로필에 공개돼요.',
  '업로드 정책을 어긴 사진에 대한 책임은 작가에게 있어요.',
];

// 1단계 화면: 정책 동의 → 사진 선택 → 올린 사진 목록(UploadQueue) → 취소/다음
export default function PhotoUploader({
  policyAgreed,
  onPolicyAgreedChange,
  policyError,
  onFilesChange,
  rejectMessages,
  photos,
  onRemove,
  onRetry,
  onRetryAll,
  onCancel,
  onNext,
  nextDisabled,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const agreeRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  //20장 기준은 상태 무관 전체 장수 (완료 장수는 목록 제목에)
  const isFull = photos.length >= MAX_PHOTOS;

  //안내가 뜨면 고칠 곳(체크박스)으로 바로 보낸다
  useEffect(() => {
    if (policyError) agreeRef.current?.focus();
  }, [policyError]);

  return (
    <div className={styles.uploader}>
      <section className={styles.policy} aria-label="공개 정책">
        <ul className={styles.policyList}>
          {POLICIES.map((policy) => (
            <li key={policy}>{policy}</li>
          ))}
        </ul>
        <label className={styles.agree}>
          <input
            ref={agreeRef}
            type="checkbox"
            className={styles.checkboxInput}
            aria-invalid={policyError || undefined}
            aria-describedby={policyError ? errorId : undefined}
            checked={policyAgreed}
            onChange={(e) => onPolicyAgreedChange(e.target.checked)}
          />
          <span className={styles.checkbox} aria-hidden="true">
            ✓
          </span>
          위 내용을 확인했으며 동의해요 (필수)
        </label>
        {policyError && (
          <p id={errorId} className={styles.policyError} role="alert">
            공개 정책에 동의해 주세요.
          </p>
        )}
      </section>

      <div className={styles.select}>
        <div className={styles.selectRow}>
          {/* 파일 input은 숨기고 버튼으로 연다 */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={onFilesChange}
          />
          <Button
            variant="outline"
            size="md"
            disabled={!policyAgreed || isFull}
            onClick={() => inputRef.current?.click()}
          >
            + 사진 선택
          </Button>
          <p className={styles.hint}>
            JPG·PNG·WebP, 파일당 최대 20MB · 최대 {MAX_PHOTOS}장까지 한 번에
            고를 수 있어요
          </p>
          <p className={styles.limit}>
            <span className={styles.limitCurrent}>{photos.length}</span> /{' '}
            {MAX_PHOTOS}
          </p>
        </div>
        <div aria-live="polite">
          {rejectMessages.map((message) => (
            <p key={message} className={styles.reject}>
              {message}
            </p>
          ))}
        </div>
      </div>

      {photos.length > 0 && (
        <UploadQueue
          photos={photos}
          onRemove={onRemove}
          onRetry={onRetry}
          onRetryAll={onRetryAll}
        />
      )}

      <div className={styles.footer}>
        <Button variant="outline" size="md" onClick={onCancel}>
          취소
        </Button>
        <Button size="md" disabled={nextDisabled} onClick={onNext}>
          다음
        </Button>
      </div>
    </div>
  );
}
