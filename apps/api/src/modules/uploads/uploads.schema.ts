import { z } from 'zod';

// PF-02: JPG·PNG·WebP, 파일당 최대 20MB
export const UPLOAD_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 20;

// POST /me/photos/upload-urls
// policyAgreed는 값이 없거나 false면 서비스에서 POLICY_NOT_AGREED로 막는다 (PF-08)
export const uploadUrlsBodySchema = z.object({
  policyAgreed: z.unknown().optional(),
  files: z
    .array(
      z.object({
        fileName: z
          .string('파일 이름이 필요해요.')
          .min(1, '파일 이름이 필요해요.')
          .max(255, '파일 이름이 너무 길어요.'),
        contentType: z.string('파일 형식이 필요해요.'),
        fileSize: z
          .number('파일 크기가 필요해요.')
          .int('파일 크기가 올바르지 않아요.')
          .positive('빈 파일은 올릴 수 없어요.'),
      }),
      '올릴 파일 목록이 필요해요.',
    )
    .min(1, '올릴 파일을 1개 이상 골라 주세요.')
    .max(
      MAX_FILES_PER_REQUEST,
      `한 번에 ${MAX_FILES_PER_REQUEST}개까지 올릴 수 있어요.`,
    ),
});

// POST /me/photos
// 카테고리·스타일·키워드 규칙은 photo-info.ts에서 코드별로 검증한다
const stringList = z.array(z.string()).default([]);

export const registerPhotosBodySchema = z.object({
  items: z
    .array(
      z.object({
        uploadKey: z
          .string('업로드 키가 필요해요.')
          .min(1, '업로드 키가 필요해요.'),
        categories: stringList,
        styles: stringList,
        keywords: stringList,
        description: z.string().nullish(),
      }),
      '등록할 사진 목록이 필요해요.',
    )
    .min(1, '등록할 사진을 1장 이상 보내 주세요.')
    .max(
      MAX_FILES_PER_REQUEST,
      `한 번에 ${MAX_FILES_PER_REQUEST}장까지 등록할 수 있어요.`,
    )
    .refine(
      (items) =>
        new Set(items.map((item) => item.uploadKey)).size === items.length,
      '같은 업로드 키를 두 번 보낼 수 없어요.',
    ),
  representativeUploadKey: z.string().min(1).nullish(),
});

export type UploadUrlsBody = z.infer<typeof uploadUrlsBodySchema>;
export type RegisterPhotosBody = z.infer<typeof registerPhotosBodySchema>;

// PUT /storage/local/... (개발용 로컬 저장소)
export const localUploadQuerySchema = z.object({
  type: z.string(),
  size: z.coerce.number().int().positive(),
  expires: z.coerce.number().int(),
  sig: z.string().min(1),
});
