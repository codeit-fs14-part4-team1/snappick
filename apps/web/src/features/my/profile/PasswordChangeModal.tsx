'use client';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getPasswordError, PASSWORD_HINT } from '@/features/auth/password';
import { changeMyPassword } from './api';
import { ApiError } from '@/lib/api';

import styles from './PasswordChangeModal.module.css';

// 비밀번호 변경 모달에서 사용할 Props 및 입력 데이터 타입 정의
type PasswordChangeModalProps = {
  open: boolean;
  onClose: () => void;
};

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';
type PasswordValues = Record<PasswordField, string>;
type PasswordErrors = Partial<Record<PasswordField, string>>;

// 기존 서버 규칙에 따라 비밀번호 유효성을 검사
// 비밀번호는 공백도 실제 입력값에 해당하므로 trim을 적용하지 않음
function validatePasswords(values: PasswordValues): PasswordErrors {
  const errors: PasswordErrors = {};

  if (!values.currentPassword) {
    errors.currentPassword = '현재 비밀번호를 입력해 주세요.';
  }

  const newPasswordError = getPasswordError(values.newPassword);

  if (newPasswordError) {
    errors.newPassword = newPasswordError;
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = '현재 비밀번호와 다른 비밀번호를 입력해 주세요.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = '새 비밀번호를 한 번 더 입력해 주세요.';
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = '비밀번호가 일치하지 않아요.';
  }

  return errors;
}

// 모달을 닫으면 입력 폼을 제거하여 이전 비밀번호가 남지 않도록 함
export default function PasswordChangeModal({
  open,
  onClose,
}: PasswordChangeModalProps) {
  return open ? <PasswordChangeForm onClose={onClose} /> : null;
}

function PasswordChangeForm({ onClose }: { onClose: () => void }) {
  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();
  const id = useId();
  const formId = `${id}-password-form`;

  // 비밀번호 입력값, 유효성 검사 및 저장 상태를 관리함
  const [values, setValues] = useState<PasswordValues>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [touched, setTouched] = useState<
    Partial<Record<PasswordField, boolean>>
  >({});
  const [formError, setFormError] = useState('');
  const [serverErrors, setServerErrors] = useState<PasswordErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // 중복 요청 및 컴포넌트 해제 이후의 상태 변경을 방지함
  const savingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 유효성 검사 결과에 따라 변경 버튼 및 오류 문구 표시 여부를 결정함
  const errors = validatePasswords(values);
  const canSubmit = !isSaving && Object.keys(errors).length === 0;

  // 서버에서 반환한 오류와 입력값 유효성 검사 오류를 함께 처리함
  const currentError =
    serverErrors.currentPassword ??
    (touched.currentPassword ? errors.currentPassword : undefined);

  const newError =
    serverErrors.newPassword ??
    (touched.newPassword ? errors.newPassword : undefined);

  const confirmError = touched.confirmPassword
    ? errors.confirmPassword
    : undefined;

  // 입력값이 변경되면 해당 입력창의 서버 오류를 초기화함
  function changeField(field: PasswordField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));

    setServerErrors((current) => {
      const next = { ...current };

      delete next[field];

      // 현재 비밀번호가 변경되면 새 비밀번호와의 동일 여부도 다시 판단함
      if (field === 'currentPassword') {
        delete next.newPassword;
      }

      return next;
    });

    setFormError('');
  }

  // 입력창에서 포커스가 벗어나면 해당 필드의 오류를 표시함
  function blurField(field: PasswordField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  // 비밀번호 변경 요청 중에는 모달을 닫지 못하도록 함
  function closeModal() {
    if (!savingRef.current) onClose();
  }

  // 비밀번호 유효성 검사 및 변경 API 요청을 처리함
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current) return;

    setTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });

    if (Object.keys(validatePasswords(values)).length > 0) return;

    savingRef.current = true;
    setIsSaving(true);
    setFormError('');
    setServerErrors({});

    try {
      // 새 비밀번호 확인값은 FE에서만 검사하고 서버에는 전달하지 않음
      await changeMyPassword(
        {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        },
        fetchWithAuth,
      );

      if (!mountedRef.current) return;

      showToast('비밀번호를 변경했어요.');
      onClose();
    } catch (error) {
      if (!mountedRef.current) return;

      // 백엔드의 상세 오류 코드에 따라 해당 입력창에 오류를 표시함
      if (error instanceof ApiError && error.status === 400) {
        if (error.code === 'INVALID_CURRENT_PASSWORD') {
          setServerErrors({
            currentPassword: '현재 비밀번호가 일치하지 않아요.',
          });
          return;
        }

        if (error.code === 'SAME_AS_CURRENT_PASSWORD') {
          setServerErrors({
            newPassword: '현재 비밀번호와 다른 비밀번호를 입력해 주세요.',
          });
          return;
        }
      }

      // 특정 입력창과 관련 없는 오류는 폼 하단에 표시함
      setFormError('비밀번호를 변경하지 못했어요. 다시 시도해 주세요.');
    } finally {
      // 요청 성공 여부와 관계없이 저장 상태를 초기화함
      savingRef.current = false;

      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }

  return (
    <Modal
      open
      onClose={closeModal}
      title="비밀번호 변경"
      className={styles.modal}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="lg"
            className={`${styles.actionButton} ${styles.cancelButton}`}
            disabled={isSaving}
            onClick={closeModal}
          >
            취소
          </Button>

          <Button
            type="submit"
            form={formId}
            size="lg"
            className={`${styles.actionButton} ${styles.submitButton}`}
            disabled={!canSubmit}
          >
            {isSaving ? '변경 중' : '변경하기'}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className={styles.form}
        onSubmit={handleSubmit}
        aria-busy={isSaving}
        noValidate
      >
        <div className={styles.fields}>
          {/* 현재 비밀번호 */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-current`}>
              현재 비밀번호
            </label>

            <input
              id={`${id}-current`}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className={styles.input}
              placeholder="현재 비밀번호를 입력해 주세요"
              value={values.currentPassword}
              disabled={isSaving}
              required
              aria-invalid={Boolean(currentError)}
              aria-describedby={
                currentError ? `${id}-current-error` : undefined
              }
              onChange={(event) =>
                changeField('currentPassword', event.target.value)
              }
              onBlur={() => blurField('currentPassword')}
            />

            {currentError && (
              <p id={`${id}-current-error`} className={styles.error}>
                {currentError}
              </p>
            )}
          </div>

          {/* 새 비밀번호 */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-new`}>
              새 비밀번호
            </label>

            <input
              id={`${id}-new`}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              className={styles.input}
              placeholder="새 비밀번호를 입력해 주세요"
              value={values.newPassword}
              disabled={isSaving}
              required
              aria-invalid={Boolean(newError)}
              aria-describedby={`${id}-new-help`}
              onChange={(event) =>
                changeField('newPassword', event.target.value)
              }
              onBlur={() => blurField('newPassword')}
            />

            <p
              id={`${id}-new-help`}
              className={newError ? styles.error : styles.help}
            >
              {newError ?? PASSWORD_HINT}
            </p>
          </div>

          {/* 새 비밀번호 확인 */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-confirm`}>
              새 비밀번호 확인
            </label>

            <input
              id={`${id}-confirm`}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={styles.input}
              placeholder="새 비밀번호를 한 번 더 입력해 주세요"
              value={values.confirmPassword}
              disabled={isSaving}
              required
              aria-invalid={Boolean(confirmError)}
              aria-describedby={
                confirmError ? `${id}-confirm-error` : undefined
              }
              onChange={(event) =>
                changeField('confirmPassword', event.target.value)
              }
              onBlur={() => blurField('confirmPassword')}
            />

            {confirmError && (
              <p id={`${id}-confirm-error`} className={styles.error}>
                {confirmError}
              </p>
            )}
          </div>
        </div>

        {/* 비밀번호 변경 API 요청 실패 안내 */}
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  );
}
