'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Category, Region } from '@snappick/shared';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';

import { CategoryLabel, RegionLabel } from '@/constants/enum-labels';
import type {
  PhotographerProfile,
  UpdatePhotographerProfileInput,
} from '@/features/profile/types';

import styles from './PhotographerBasicInfoModal.module.css';

// 서버에서 허용하는 프로필 이미지 최대 크기를 5MB로 정의함
const PROFILE_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

// 기본 정보 수정 모달에서 사용할 Props 정의
type PhotographerBasicInfoModalProps = {
  open: boolean;
  onClose: () => void;
  photographer: PhotographerProfile;

  // 기본 정보와 선택한 이미지를 서버에 저장하지 않고 임시 상태에 반영함
  onApply: (input: UpdatePhotographerProfileInput, imageFile?: File) => void;
};

export default function PhotographerBasicInfoModal({
  open,
  onClose,
  photographer,
  onApply,
}: PhotographerBasicInfoModalProps) {
  // 입력 폼과 각 입력 요소의 고유 ID를 생성함
  const formId = useId();

  // 입력값 초기화를 위해 폼 요소를 참조함
  const formRef = useRef<HTMLFormElement>(null);

  // 프로필 이미지 파일 선택창을 열기 위해 input 요소를 참조함
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 이미지 미리보기에 사용하는 임시 URL을 관리함
  const imagePreviewUrlRef = useRef<string | null>(null);

  // 선택한 프로필 이미지 파일과 미리보기 URL을 관리함
  const [selectedImage, setSelectedImage] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);

  // 입력값 오류와 저장 결과를 안내하는 Toast를 사용함
  const { showToast } = useToast();

  // 현재 등록된 촬영 카테고리를 초기 선택값으로 설정함
  const [selectedCategories, setSelectedCategories] = useState(() => [
    ...photographer.categories,
  ]);

  // 현재 등록된 활동 지역을 초기 선택값으로 설정함
  const [selectedRegions, setSelectedRegions] = useState(() => [
    ...photographer.regions,
  ]);

  // 활동 지역 추가 목록의 열림 상태를 관리함
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);

  // 팝오버 내부에서 선택한 활동 지역을 임시로 관리함
  const [draftRegions, setDraftRegions] = useState(() => [
    ...photographer.regions,
  ]);

  // 컴포넌트가 제거될 때 이미지 미리보기 URL을 해제함
  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
      }
    };
  }, []);

  // 선택한 프로필 이미지와 미리보기 상태를 초기화함
  const resetSelectedImage = () => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }

    setSelectedImage(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // 이미지 파일의 형식을 확인하고 미리보기를 생성함
  const handleSelectImage = (file: File | undefined) => {
    if (!file) {
      return;
    }

    // JPG, PNG, WebP 형식의 이미지 파일만 허용함
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      resetSelectedImage();

      showToast('JPG, PNG, WebP 이미지 파일만 선택할 수 있어요.', 'error');
      return;
    }

    // 빈 이미지 파일은 선택할 수 없도록 처리함
    if (file.size === 0) {
      resetSelectedImage();
      showToast('빈 이미지 파일은 선택할 수 없어요.', 'error');
      return;
    }

    // 서버의 업로드 제한과 동일하게 5MB 초과 파일을 차단함
    if (file.size > PROFILE_IMAGE_MAX_FILE_SIZE) {
      resetSelectedImage();
      showToast('프로필 이미지는 5MB 이하만 업로드할 수 있어요.', 'error');
      return;
    }

    // 이전에 생성한 이미지 미리보기 URL을 해제함
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
    }

    // 선택한 이미지의 미리보기 URL을 생성함
    const previewUrl = URL.createObjectURL(file);

    imagePreviewUrlRef.current = previewUrl;

    setSelectedImage({
      file,
      previewUrl,
    });
  };

  // 팝오버를 열 때 현재 선택된 지역을 임시 상태에 복사함
  const handleOpenRegionPicker = () => {
    if (isRegionPickerOpen) {
      setIsRegionPickerOpen(false);
      return;
    }

    setDraftRegions([...selectedRegions]);
    setIsRegionPickerOpen(true);
  };

  // 팝오버 내부에서 활동 지역을 선택하거나 해제함
  const handleToggleDraftRegion = (region: Region) => {
    setDraftRegions((prev) =>
      prev.includes(region)
        ? prev.filter((selectedRegion) => selectedRegion !== region)
        : [...prev, region],
    );
  };

  // 팝오버에서 선택한 활동 지역을 모두 해제함
  const handleResetDraftRegions = () => {
    setDraftRegions([]);
  };

  // 팝오버에서 선택한 활동 지역을 폼에 반영함
  const handleApplyRegions = () => {
    setSelectedRegions([...draftRegions]);
    setIsRegionPickerOpen(false);
  };

  // 모달을 닫을 때 저장하지 않은 입력값과 선택 상태를 초기화함
  const handleClose = () => {
    formRef.current?.reset();

    // 선택한 프로필 이미지와 미리보기 상태를 초기화함
    resetSelectedImage();

    setSelectedRegions([...photographer.regions]);
    setDraftRegions([...photographer.regions]);
    setSelectedCategories([...photographer.categories]);
    setIsRegionPickerOpen(false);

    onClose();
  };

  // 모달을 닫으면 아직 적용하지 않은 입력 내용만 초기화함
  const handleRequestClose = () => {
    handleClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleRequestClose}
      title="기본 정보 수정"
      className={styles.modalSurface}
      footer={
        <>
          {/* 모달의 취소는 적용하지 않은 입력값만 폐기함 */}
          <Button variant="outline" size="lg" onClick={handleRequestClose}>
            취소
          </Button>

          {/* 최종 서버 저장 전 화면에 입력값을 임시 적용함 */}
          <Button type="submit" form={formId} variant="primary" size="lg">
            적용
          </Button>
        </>
      }
    >
      {/* 사진작가 기본 정보 입력 폼 */}
      <form
        ref={formRef}
        id={formId}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();

          // 폼에 입력한 기본 정보 값을 가져옴
          const formData = new FormData(event.currentTarget);

          const nickname = String(formData.get('nickname') ?? '').trim();
          const career = String(formData.get('career') ?? '').trim();
          const introduction = String(
            formData.get('introduction') ?? '',
          ).trim();

          // 활동명이 2~20자인지 확인함
          if (nickname.length < 2 || nickname.length > 20) {
            showToast(
              '활동명은 앞뒤 공백을 제외하고 2~20자로 입력해 주세요.',
              'error',
            );
            return;
          }

          // 경력이 입력되지 않았다면 PATCH 요청에서 제외하도록 처리함
          const careerYears = career === '' ? undefined : Number(career);

          // 경력이 0~80 사이의 정수인지 확인함
          if (
            careerYears !== undefined &&
            (!Number.isInteger(careerYears) ||
              careerYears < 0 ||
              careerYears > 80)
          ) {
            showToast('경력은 0~80 사이의 정수로 입력해 주세요.', 'error');
            return;
          }

          // 상세 소개가 최대 1000자를 초과하지 않는지 확인함
          if (introduction.length > 1000) {
            showToast('상세 소개는 1000자 이하로 입력해 주세요.', 'error');
            return;
          }

          // 최종 수정 완료를 누르기 전에는 PATCH 요청을 실행하지 않음
          onApply(
            {
              nickname,
              ...(careerYears !== undefined ? { career: careerYears } : {}),
              introduction: introduction === '' ? null : introduction,
              regions: selectedRegions,
              categories: selectedCategories,
            },
            selectedImage?.file,
          );

          // 선택한 이미지와 기본 정보가 임시 상태에 반영되었음을 안내함
          showToast(
            '기본 정보를 임시 적용했어요. 수정 완료를 눌러 저장해 주세요.',
          );

          onClose();
        }}
      >
        {/* 현재 등록된 프로필 이미지와 이미지 변경 영역을 표시함 */}
        <div className={styles.field}>
          <span className={styles.label}>
            프로필 이미지 <span className={styles.requiredMark}>*</span>
          </span>

          <div className={styles.profileImageRow}>
            {/* 새로 선택한 이미지를 우선 표시하고 없으면 기존 이미지를 표시함 */}
            <div className={styles.profileImagePreview}>
              {selectedImage?.previewUrl || photographer.profileImageUrl ? (
                <Image
                  src={
                    selectedImage?.previewUrl ?? photographer.profileImageUrl!
                  }
                  alt={
                    selectedImage
                      ? '선택한 프로필 이미지 미리보기'
                      : `${photographer.nickname} 프로필 이미지`
                  }
                  fill
                  sizes="96px"
                  unoptimized
                />
              ) : (
                <span
                  className={styles.profileImagePlaceholder}
                  role="img"
                  aria-label="등록된 프로필 이미지 없음"
                />
              )}
            </div>

            {/* 이미지 변경 버튼과 지원 형식을 표시함 */}
            <div className={styles.profileImageActions}>
              {/* 이미지 변경 버튼에서 사용할 파일 선택창을 숨겨서 제공함 */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) =>
                  handleSelectImage(event.currentTarget.files?.[0])
                }
              />

              {/* 이미지 변경 버튼을 누르면 파일 선택창을 표시함 */}
              <button
                type="button"
                className={styles.imageChangeButton}
                onClick={() => imageInputRef.current?.click()}
              >
                이미지 변경
              </button>

              <p className={styles.imageHint}>JPG · PNG · WebP</p>
            </div>
          </div>
        </div>

        {/* 활동명과 경력 입력 영역 */}
        <div className={styles.fieldRow}>
          {/* 활동명 입력 */}
          <div className={styles.field}>
            <label htmlFor={`${formId}-nickname`} className={styles.label}>
              활동명 <span className={styles.requiredMark}>*</span>
            </label>

            <input
              id={`${formId}-nickname`}
              name="nickname"
              type="text"
              className={styles.input}
              defaultValue={photographer.nickname}
              minLength={2}
              maxLength={20}
              required
            />
          </div>

          {/* 경력 입력 */}
          <div className={styles.field}>
            <label htmlFor={`${formId}-career`} className={styles.label}>
              경력 <span className={styles.requiredMark}>*</span>
            </label>

            {/* 경력 입력창 오른쪽에 년 단위를 표시함 */}
            <div className={styles.careerInputWrapper}>
              <input
                id={`${formId}-career`}
                name="career"
                type="number"
                className={styles.input}
                defaultValue={photographer.career ?? 0}
                min={0}
                max={80}
                step={1}
                required
                aria-describedby={`${formId}-career-unit`}
              />

              <span id={`${formId}-career-unit`} className={styles.careerUnit}>
                년
              </span>
            </div>
          </div>
        </div>

        {/* 상세 소개 입력 영역 */}
        <div className={styles.field}>
          <label htmlFor={`${formId}-introduction`} className={styles.label}>
            상세 소개 <span className={styles.requiredMark}>*</span>
          </label>

          <textarea
            id={`${formId}-introduction`}
            name="introduction"
            className={styles.textarea}
            defaultValue={photographer.introduction ?? ''}
            maxLength={1000}
            rows={5}
          />
        </div>

        {/* 활동 지역 선택 및 추가 영역 */}
        <div className={styles.field}>
          <span className={styles.label}>
            활동 지역 <span className={styles.requiredMark}>*</span>
          </span>

          <div className={styles.regionPickerAnchor}>
            {/* 적용된 활동 지역과 지역 추가 버튼을 표시함 */}
            <div className={styles.regionChips}>
              {selectedRegions.map((region) => (
                <span key={region} className={styles.regionChip}>
                  {RegionLabel[region as keyof typeof RegionLabel] ?? region}
                </span>
              ))}

              <button
                type="button"
                className={styles.addRegionButton}
                aria-expanded={isRegionPickerOpen}
                aria-controls={`${formId}-region-picker`}
                onClick={handleOpenRegionPicker}
              >
                + 지역 추가
              </button>
            </div>

            {/* 활동 지역을 선택하는 팝오버를 표시함 */}
            {isRegionPickerOpen && (
              <div
                id={`${formId}-region-picker`}
                className={styles.regionPicker}
                role="group"
                aria-labelledby={`${formId}-region-picker-title`}
              >
                <p
                  id={`${formId}-region-picker-title`}
                  className={styles.regionPickerTitle}
                >
                  작가 활동 지역
                </p>

                {/* 전체 활동 지역을 체크박스로 표시함 */}
                <div className={styles.regionOptions}>
                  {Object.values(Region).map((region) => (
                    <label
                      key={region}
                      className={styles.regionOption}
                      data-selected={draftRegions.includes(region)}
                    >
                      <input
                        type="checkbox"
                        className={styles.regionCheckbox}
                        checked={draftRegions.includes(region)}
                        onChange={() => handleToggleDraftRegion(region)}
                      />

                      <span>{RegionLabel[region]}</span>
                    </label>
                  ))}
                </div>

                {/* 지역 선택 초기화 및 적용 버튼 */}
                <div className={styles.regionPickerActions}>
                  <button
                    type="button"
                    className={styles.regionResetButton}
                    onClick={handleResetDraftRegions}
                  >
                    초기화
                  </button>

                  <button
                    type="button"
                    className={styles.regionApplyButton}
                    onClick={handleApplyRegions}
                  >
                    적용
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* 촬영 카테고리 선택 영역 */}
        <div className={styles.field}>
          <span id={`${formId}-categories-label`} className={styles.label}>
            촬영 카테고리 <span className={styles.requiredMark}>*</span>
          </span>

          {/* 촬영 카테고리 9개를 복수 선택할 수 있도록 표시함 */}
          <div
            className={styles.categoryChips}
            role="group"
            aria-labelledby={`${formId}-categories-label`}
          >
            {Object.values(Category).map((category) => {
              const isSelected = selectedCategories.includes(category);

              return (
                <button
                  key={category}
                  type="button"
                  className={styles.categoryChip}
                  data-selected={isSelected}
                  aria-pressed={isSelected}
                  onClick={() =>
                    setSelectedCategories((prev) =>
                      prev.includes(category)
                        ? prev.filter((item) => item !== category)
                        : [...prev, category],
                    )
                  }
                >
                  {CategoryLabel[category]}
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}
