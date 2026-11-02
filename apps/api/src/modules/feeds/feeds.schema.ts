import { z } from 'zod';

// 쉼표 구분 문자열과 반복 파라미터(?styles=A&styles=B)를 모두 배열로 받는다
const csv = z.preprocess(
  (value) =>
    value === undefined
      ? []
      : [value]
          .flat()
          .flatMap((item) => String(item).split(','))
          .map((item) => item.trim())
          .filter(Boolean),
  z.array(z.string()),
);

const limit = z.coerce.number().int().min(1).max(50).default(20);

export const photoParamsSchema = z.object({
  photoId: z.uuid(),
});

export const photographerParamsSchema = z.object({
  photographerId: z.uuid(),
});

export const photographerPhotosQuerySchema = z.object({
  excludePhotoId: z.uuid().optional(),
  cursor: z.string().min(1).optional(),
  limit,
});

export const SORTS = ['random', 'latest', 'popular'] as const;

export const photosQuerySchema = z.object({
  keyword: z.string().trim().max(50).optional(),
  category: z.string().optional(),
  styles: csv,
  regions: csv,
  sort: z.enum(SORTS).default('random'),
  seed: z.string().trim().min(1).max(32).optional(),
  cursor: z.string().min(1).optional(),
  limit,
});

export type PhotosQuery = z.infer<typeof photosQuerySchema>;
