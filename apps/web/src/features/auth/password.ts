// 회원가입과 비밀번호 변경에서 함께 사용하는 비밀번호 입력 규칙
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 16;
export const PASSWORD_HINT = `${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자, 영문·숫자·특수문자를 포함해 주세요.`;

// 비밀번호 길이와 영문·숫자·특수문자 포함 여부를 확인함
// 길이를 먼저 안내하고, 길이가 맞으면 빠진 문자 종류를 알려줌
// 비밀번호는 공백도 실제 입력값에 해당하므로 trim을 적용하지 않음
export function getPasswordError(value: string): string {
  if (value.length === 0) {
    return '비밀번호를 입력해 주세요.';
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  const missingTypes = [
    !/[A-Za-z]/.test(value) && '영문',
    !/[0-9]/.test(value) && '숫자',
    !/[^\p{L}\p{N}\s]/u.test(value) && '특수문자',
  ].filter(Boolean);

  if (missingTypes.length > 0) {
    // 마지막 단어에 맞춰 조사를 붙임 (영문을, 숫자를, 특수문자를)
    const particle = missingTypes.at(-1) === '영문' ? '을' : '를';
    return `${missingTypes.join('·')}${particle} 포함해 주세요.`;
  }

  return '';
}
