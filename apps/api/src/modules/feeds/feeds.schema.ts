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

export const SORTS = ['recommended', 'latest', 'popular'] as const;

export const photosQuerySchema = z.object({
  keyword: z.string().trim().max(50).optional(),
  category: z.string().optional(),
  styles: csv,
  regions: csv,
  // 기본순(random)은 추천순으로 바뀌었다. FE가 recommended로 바꿀 때까지 random도 추천순으로 받는다
  // FE 반영 후 preprocess를 지운다. seed는 더 쓰지 않아 보내도 무시한다
  sort: z.preprocess(
    (value) => (value === 'random' ? 'recommended' : value),
    z.enum(SORTS).default('recommended'),
  ),
  cursor: z.string().min(1).optional(),
  limit,
});

export type PhotosQuery = z.infer<typeof photosQuerySchema>;
