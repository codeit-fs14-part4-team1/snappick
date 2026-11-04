import { z } from 'zod';

const MESSAGE = '요청 값이 올바르지 않아요.';

export const myPhotoParamsSchema = z.object({
  photoId: z.uuid(MESSAGE),
});

// PATCH /me/photos/batch
// 보낸 필드만 통째로 교체한다. 값 규칙은 photo-info.ts에서 코드별로 검증한다
const photoUpdateSchema = z
  .object({
    photoId: z.uuid(MESSAGE),
    categories: z.array(z.string(MESSAGE), MESSAGE).optional(),
    styles: z.array(z.string(MESSAGE), MESSAGE).optional(),
    keywords: z.array(z.string(MESSAGE), MESSAGE).optional(),
    description: z.string(MESSAGE).nullable().optional(),
  })
  .refine(
    ({ categories, styles, keywords, description }) =>
      categories !== undefined ||
      styles !== undefined ||
      keywords !== undefined ||
      description !== undefined,
    MESSAGE,
  );

export const photoBatchBodySchema = z
  .object(
    {
      updates: z.array(photoUpdateSchema, MESSAGE).default([]),
      deletePhotoIds: z.array(z.uuid(MESSAGE), MESSAGE).default([]),
      representativePhotoId: z.uuid(MESSAGE).nullable().optional(),
    },
    MESSAGE,
  )
  .refine(
    ({ updates, deletePhotoIds, representativePhotoId }) =>
      updates.length > 0 ||
      deletePhotoIds.length > 0 ||
      Boolean(representativePhotoId),
    MESSAGE,
  );

export type PhotoBatchBody = z.infer<typeof photoBatchBodySchema>;
