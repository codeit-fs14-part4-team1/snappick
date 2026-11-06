import { Category, Style } from '../../generated/prisma/enums.js';
import { HttpError } from '../../utils/http-error.js';

/**
 * 사진 정보 검증 (PF-07, EXP-03, EXP-04)
 * 사진 등록(POST /me/photos)과 사진 일괄 수정(PATCH /me/photos/batch)이 같이 쓴다
 */
export type PhotoInfoInput = {
  categories: string[];
  styles: string[];
  keywords: string[];
  description?: string | null | undefined;
};

export type PhotoInfo = {
  categories: Category[];
  styles: Style[];
  keywords: string[];
  description: string | null;
};

const CATEGORY_VALUES = new Set<string>(Object.values(Category));
const STYLE_VALUES = new Set<string>(Object.values(Style));

const MAX_STYLES = 3;
const MAX_KEYWORDS = 5;
const MAX_KEYWORD_LENGTH = 10;
// PF-07 한 줄 설명
const MAX_DESCRIPTION_LENGTH = 50;

function assertNoDuplicates(values: string[]): void {
  if (new Set(values).size !== values.length) {
    throw new HttpError(
      400,
      'DUPLICATE_VALUE',
      '같은 값을 두 번 선택할 수 없어요.',
    );
  }
}

export function parseCategories(values: string[]): Category[] {
  if (values.length === 0) {
    throw new HttpError(
      400,
      'CATEGORY_REQUIRED',
      '카테고리를 1개 이상 선택해 주세요.',
    );
  }
  if (values.some((value) => !CATEGORY_VALUES.has(value))) {
    throw new HttpError(
      400,
      'INVALID_CATEGORY',
      '선택할 수 없는 카테고리예요.',
    );
  }
  assertNoDuplicates(values);
  return values as Category[];
}

export function parseStyles(values: string[]): Style[] {
  if (values.some((value) => !STYLE_VALUES.has(value))) {
    throw new HttpError(400, 'INVALID_STYLE', '선택할 수 없는 스타일이에요.');
  }
  assertNoDuplicates(values);
  if (values.length > MAX_STYLES) {
    throw new HttpError(
      400,
      'TOO_MANY_STYLES',
      `스타일은 최대 ${MAX_STYLES}개까지 선택할 수 있어요.`,
    );
  }
  return values as Style[];
}

export function parseKeywords(values: string[]): string[] {
  if (
    values.length > MAX_KEYWORDS ||
    values.some(
      (keyword) =>
        keyword.length === 0 ||
        keyword.length > MAX_KEYWORD_LENGTH ||
        /\s/.test(keyword),
    )
  ) {
    throw new HttpError(
      400,
      'INVALID_KEYWORD',
      `키워드는 최대 ${MAX_KEYWORDS}개, 공백 없이 ${MAX_KEYWORD_LENGTH}자 이내로 입력해 주세요.`,
    );
  }
  assertNoDuplicates(values);
  return values;
}

export function parseDescription(value: string | null | undefined) {
  const description = value?.trim() ?? '';
  // 이모지 같은 글자도 한 글자로 센다
  if ([...description].length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpError(
      400,
      'INVALID_DESCRIPTION',
      `한 줄 설명은 ${MAX_DESCRIPTION_LENGTH}자 이내로 입력해 주세요.`,
    );
  }
  return description === '' ? null : description;
}

export function parsePhotoInfo(input: PhotoInfoInput): PhotoInfo {
  return {
    categories: parseCategories(input.categories),
    styles: parseStyles(input.styles),
    keywords: parseKeywords(input.keywords),
    description: parseDescription(input.description),
  };
}
