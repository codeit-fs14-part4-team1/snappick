import { z } from 'zod';

export const productParamsSchema = z.object({
  photographerId: z.uuid(),
});

export const productIdParamsSchema = z.object({
  productId: z.uuid(),
});

const isMissing = (value: unknown) => value === undefined || value === null;

const fieldError = (missing: string, invalid: string) => ({
  error: (issue: { input?: unknown }) =>
    isMissing(issue.input) ? missing : invalid,
});

// 상품의 조건은 임의로 설정했습니다. 추후 정책을 논의하고 설정하겠습니다. feat.Happy_DCS
export const createProductSchema = z
  .object({
    name: z
      .string(
        fieldError(
          '상품명은 필수 요소입니다.',
          '상품명은 문자열이어야 합니다.',
        ),
      )
      .trim()
      .min(1, '상품명을 입력해주세요.')
      .max(50, '상품명은 50자 이하로 입력해주세요.'),
    price: z
      .number(
        fieldError(
          '상품 가격은 필수 요소입니다.',
          '상품 가격은 숫자여야 합니다.',
        ),
      )
      .int('상품 가격은 정수여야 합니다.')
      .min(0, '상품 가격은 0원 이상이어야 합니다.')
      .max(100_000_000, '상품 가격은 100,000,000원 이하이어야 합니다.'),
    durationMinutes: z
      .number(
        fieldError(
          '상품 촬영 시간은 필수 요소입니다.',
          '상품 촬영 시간은 숫자여야 합니다.',
        ),
      )
      .int('상품 촬영 시간은 정수여야 합니다.')
      .min(60, '상품 촬영 시간은 1시간 이상이어야 합니다.')
      .max(2_880, '상품 촬영 시간은 48시간 이하여야 합니다.'),
    photoCount: z
      .number(
        fieldError(
          '상품 사진 수는 필수 요소입니다.',
          '상품 사진 수는 숫자여야 합니다.',
        ),
      )
      .int('상품 사진 수는 정수여야 합니다.')
      .min(1, '상품 사진 수는 1장 이상이어야 합니다.')
      .max(10_000, '상품 사진 수는 10,000장 이하이어야 합니다.'),
    includesOriginal: z.boolean(
      fieldError(
        '원본 제공 여부는 필수 요소입니다.',
        '원본 제공 여부는 true 또는 false여야 합니다.',
      ),
    ),
    commonNotice: z
      .string({ error: '공통 안내 문구는 문자열이어야 합니다.' })
      .trim()
      .max(1_000, '공통 안내 문구는 1,000자 이하로 입력해주세요.')
      .nullable()
      .optional(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: '수정할 항목을 하나 이상 보내 주세요.',
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
