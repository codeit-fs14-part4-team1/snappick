import { z } from 'zod';

// 프로필 이미지: JPG·PNG·WebP, 최대 5MB
export const PROFILE_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

// POST /me/profile-image/upload-url
export const profileImageUploadUrlBodySchema = z.object({
  contentType: z.string('파일 형식이 필요해요.'),
  fileSize: z
    .number('파일 크기가 필요해요.')
    .int('파일 크기가 올바르지 않아요.')
    .positive('빈 파일은 올릴 수 없어요.'),
});

// PATCH /me/profile-image
export const updateProfileImageBodySchema = z.object({
  uploadKey: z.string('업로드 키가 필요해요.').min(1, '업로드 키가 필요해요.'),
});

export type ProfileImageUploadUrlBody = z.infer<
  typeof profileImageUploadUrlBodySchema
>;
export type UpdateProfileImageBody = z.infer<
  typeof updateProfileImageBodySchema
>;
