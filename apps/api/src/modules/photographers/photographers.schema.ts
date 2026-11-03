import { z } from 'zod';
import { Category, Region } from '../../generated/prisma/enums.js';

export const photographerParamsSchema = z.object({
  photographerId: z.uuid(),
});

// 제한값(길이, 개수)은 명세 확인 전 임시값
export const updateProfileSchema = z
  .object({
    nickname: z
      .string()
      .trim()
      .min(2, '닉네임은 2자 이상이어야 합니다.')
      .max(20, '닉네임은 20자 이하여야 합니다.'),
    career: z.number().int().min(0).max(80).nullable(),
    regions: z.array(z.enum(Region)).max(20),
    categories: z.array(z.enum(Category)).max(20),
    introduction: z
      .string()
      .trim()
      .min(1, '소개는 1자 이상이어야 합니다. 비우려면 null을 보내 주세요.')
      .max(1000)
      .nullable(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: '수정할 항목을 하나 이상 보내 주세요.',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
