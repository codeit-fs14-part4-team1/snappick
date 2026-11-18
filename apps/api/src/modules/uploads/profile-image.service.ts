import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { removeFiles, storage } from '../../lib/storage/index.js';
import { toImageUrl } from '../../utils/asset-url.js';
import { HttpError } from '../../utils/http-error.js';
import type { AccessTokenPayload } from '../../utils/tokens.js';
import { oneAtATime, toProfileWebp } from './image-processor.js';
import {
  PROFILE_IMAGE_MAX_FILE_SIZE,
  type ProfileImageUploadUrlBody,
  type UpdateProfileImageBody,
} from './profile-image.schema.js';
import { UPLOAD_EXTENSIONS } from './uploads.schema.js';

/**
 * 프로필 이미지 변경 (일반 사용자·작가 공통)
 * 임시 원본: 'uploads/profiles/{accountId}/{uuid}.jpg' (FE가 직접 올리고, 반영하면 지운다)
 * 보관본: 'profiles/{accountId}/{uuid}.webp' (users/photographers.profile_image_url에 저장)
 * 계정 ID로 경로를 나눠서 두 계정 유형을 같은 방식으로 처리한다
 */

const UPLOAD_URL_TTL_MS = 10 * 60 * 1000;

const PROFILE_UPLOAD_KEY =
  /^uploads\/profiles\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/;

// 우리가 저장한 프로필 이미지만 지운다 (시드의 '/mock/...' 등은 건드리지 않는다)
const STORED_PROFILE_KEY = /^profiles\//;

const uploadNotFound = () =>
  new HttpError(
    404,
    'UPLOAD_NOT_FOUND',
    '업로드한 파일을 찾을 수 없어요. 다시 올려 주세요.',
  );

const invalidFile = (message: string) =>
  new HttpError(400, 'INVALID_FILE', message);

const profileNotFound = () =>
  new HttpError(404, 'PROFILE_NOT_FOUND', '프로필을 찾을 수 없어요.');

/**
 * 업로드 URL 발급 (POST /me/profile-image/upload-url)
 */
export async function createProfileImageUploadUrl(
  auth: AccessTokenPayload,
  body: ProfileImageUploadUrlBody,
  apiOrigin: string,
) {
  const extension: string | undefined = UPLOAD_EXTENSIONS[body.contentType];
  if (!extension) {
    throw invalidFile('JPG, PNG, WebP 파일만 올릴 수 있어요.');
  }
  if (body.fileSize > PROFILE_IMAGE_MAX_FILE_SIZE) {
    throw invalidFile('프로필 이미지는 5MB 이하만 올릴 수 있어요.');
  }

  const key = `uploads/profiles/${auth.accountId}/${randomUUID()}.${extension}`;
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS);
  return {
    uploadKey: key,
    uploadUrl: await storage.createUploadUrl({
      key,
      contentType: body.contentType,
      size: body.fileSize,
      expiresAt,
      apiOrigin,
    }),
    expiresAt: expiresAt.toISOString(),
  };
}

// 임시 원본 키로 보관본 키를 정한다. 다시 시도해도 같은 키라 중복이 생기지 않는다
// 다른 계정이 받은 키나 형식이 다른 키는 없는 파일로 본다
function toProfileKey(uploadKey: string, accountId: string): string {
  const match = PROFILE_UPLOAD_KEY.exec(uploadKey);
  if (!match || match[1] !== accountId) {
    throw uploadNotFound();
  }
  return `profiles/${accountId}/${match[2]}.webp`;
}

async function findProfileImage(auth: AccessTokenPayload) {
  const args = {
    where: { auth_account_id: auth.accountId },
    select: { profile_image_url: true },
  };
  const profile =
    auth.accountType === 'USER'
      ? await prisma.users.findUnique(args)
      : await prisma.photographers.findUnique(args);
  if (!profile) {
    throw profileNotFound();
  }
  return profile.profile_image_url;
}

async function saveProfileImage(auth: AccessTokenPayload, key: string) {
  const args = {
    where: { auth_account_id: auth.accountId },
    data: { profile_image_url: key },
  };
  const { count } =
    auth.accountType === 'USER'
      ? await prisma.users.updateMany(args)
      : await prisma.photographers.updateMany(args);
  if (count === 0) {
    throw profileNotFound();
  }
}

/**
 * 프로필 이미지 반영 (PATCH /me/profile-image)
 * 올라온 파일을 512px 정사각형 WebP로 바꿔 저장하고 프로필에 반영한다
 * 이미 반영한 업로드 키로 다시 요청하면 같은 결과를 돌려준다(멱등)
 * 이전 이미지와 임시 원본은 반영 후 지운다 (지우기 실패는 응답에 영향 없음)
 */
export async function updateProfileImage(
  auth: AccessTokenPayload,
  body: UpdateProfileImageBody,
) {
  const profileKey = toProfileKey(body.uploadKey, auth.accountId);
  const previous = await findProfileImage(auth);

  if (previous === profileKey) {
    return { profileImageUrl: toImageUrl(profileKey) };
  }

  const object = await storage.head(body.uploadKey);
  if (!object) {
    throw uploadNotFound();
  }
  if (object.size > PROFILE_IMAGE_MAX_FILE_SIZE) {
    throw invalidFile('프로필 이미지는 5MB 이하만 올릴 수 있어요.');
  }

  const extension = body.uploadKey.slice(body.uploadKey.lastIndexOf('.') + 1);
  const image = await oneAtATime(async () =>
    toProfileWebp(await storage.read(body.uploadKey), extension),
  );
  if (!image) {
    throw invalidFile('이미지 파일이 아니거나 형식이 올바르지 않아요.');
  }
  await storage.write(profileKey, image.data, 'image/webp');

  await saveProfileImage(auth, profileKey);

  await removeFiles([
    body.uploadKey,
    ...(previous && STORED_PROFILE_KEY.test(previous) ? [previous] : []),
  ]);

  return { profileImageUrl: toImageUrl(profileKey) };
}
