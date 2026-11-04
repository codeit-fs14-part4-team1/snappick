import { env } from '../../config/env.js';
import { localDiskStorage } from './local-storage.js';
import { createS3Storage } from './s3-storage.js';
import type { Storage } from './storage.js';

export type { Storage, StoredObject, UploadTarget } from './storage.js';

// 지정하지 않으면 개발은 local, 배포(NODE_ENV=production)는 s3
function readDriver(): 'local' | 's3' {
  const value =
    process.env.STORAGE_DRIVER ?? (env.isProduction ? 's3' : 'local');
  if (value !== 'local' && value !== 's3') {
    throw new Error(`STORAGE_DRIVER는 local 또는 s3여야 합니다: ${value}`);
  }
  return value;
}

export const storageDriver = readDriver();

export const storage: Storage =
  storageDriver === 's3' ? createS3Storage() : localDiskStorage;

// 파일을 못 지워도 원래 작업은 성공으로 본다. 실패는 기록만 남긴다
export async function removeFiles(keys: string[]): Promise<void> {
  const results = await Promise.allSettled(
    keys.map((key) => storage.delete(key)),
  );
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(result.reason);
    }
  }
}
