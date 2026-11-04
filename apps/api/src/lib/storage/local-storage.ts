import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import type { Storage } from './storage.js';

/**
 * 개발용 로컬 저장소
 * 파일을 apps/web/public 아래에 저장해서, 목 이미지처럼 IMAGE_BASE_URL(web 주소)로 바로 보인다
 * 업로드 URL은 S3 presigned URL처럼 만료 시각과 서명이 붙은 이 API 주소다 (PUT /storage/local/...)
 */
const ROOT = fileURLToPath(new URL('../../../../web/public/', import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const LOCAL_UPLOAD_PATH = '/storage/local';

// 키가 ROOT 밖을 가리키지 못하게 한다 (../ 등)
function filePath(key: string): string {
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(ROOT)) {
    throw new HttpError(400, 'INVALID_UPLOAD_KEY', '잘못된 업로드 키예요.');
  }
  return resolved;
}

type SignedUpload = {
  key: string;
  contentType: string;
  size: number;
  expires: number;
};

function sign({ key, contentType, size, expires }: SignedUpload): string {
  return createHmac('sha256', env.jwtAccessSecret)
    .update([key, contentType, size, expires].join('\n'))
    .digest('base64url');
}

export function verifyLocalUpload(upload: SignedUpload, sig: string): boolean {
  const expected = Buffer.from(sign(upload));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const localDiskStorage: Storage = {
  async createUploadUrl({ key, contentType, size, expiresAt, apiOrigin }) {
    const expires = expiresAt.getTime();
    const query = new URLSearchParams({
      type: contentType,
      size: String(size),
      expires: String(expires),
      sig: sign({ key, contentType, size, expires }),
    });
    return `${apiOrigin}${LOCAL_UPLOAD_PATH}/${key}?${query.toString()}`;
  },

  async head(key) {
    try {
      const file = await stat(filePath(key));
      return {
        size: file.size,
        contentType: CONTENT_TYPES[path.extname(key)] ?? null,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  },

  async read(key) {
    return readFile(filePath(key));
  },

  async write(key, body) {
    const target = filePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  },

  async delete(key) {
    await rm(filePath(key), { force: true });
  },
};
