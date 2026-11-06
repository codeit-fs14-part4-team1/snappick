import type { Request, Response } from 'express';
import {
  localDiskStorage,
  verifyLocalUpload,
} from '../../lib/storage/local-storage.js';
import { getAuth } from '../../middlewares/authenticate.js';
import { HttpError } from '../../utils/http-error.js';
import { requirePhotographerId } from '../feeds/viewer.js';
import {
  localUploadQuerySchema,
  registerPhotosBodySchema,
  uploadUrlsBodySchema,
} from './uploads.schema.js';
import { createUploadUrls, registerPhotos } from './uploads.service.js';

export async function createUploadUrlsHandler(req: Request, res: Response) {
  const body = uploadUrlsBodySchema.parse(req.body);
  const apiOrigin = `${req.protocol}://${req.get('host')}`;
  res.json(
    await createUploadUrls(
      await requirePhotographerId(getAuth(req)),
      body,
      apiOrigin,
    ),
  );
}

export async function registerPhotosHandler(req: Request, res: Response) {
  const body = registerPhotosBodySchema.parse(req.body);
  res
    .status(201)
    .json(
      await registerPhotos(await requirePhotographerId(getAuth(req)), body),
    );
}

const LOCAL_UPLOAD_KEY =
  /^uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

// 개발용 로컬 저장소에 파일 받기 (S3 presigned URL에 PUT하는 것과 같은 흐름)
export async function putLocalUploadHandler(req: Request, res: Response) {
  const segments: unknown = req.params.key;
  const key = Array.isArray(segments) ? segments.join('/') : '';
  const query = localUploadQuerySchema.parse(req.query);

  if (!LOCAL_UPLOAD_KEY.test(key)) {
    throw new HttpError(400, 'INVALID_UPLOAD_KEY', '잘못된 업로드 키예요.');
  }
  if (Date.now() > query.expires) {
    throw new HttpError(
      403,
      'UPLOAD_URL_EXPIRED',
      '업로드 URL이 만료됐어요. 다시 받아 주세요.',
    );
  }
  const upload = {
    key,
    contentType: query.type,
    size: query.size,
    expires: query.expires,
  };
  if (!verifyLocalUpload(upload, query.sig)) {
    throw new HttpError(403, 'INVALID_UPLOAD_URL', '잘못된 업로드 URL이에요.');
  }
  // S3처럼 발급할 때의 형식·크기와 다르면 받지 않는다
  if (
    req.get('content-type') !== query.type ||
    !Buffer.isBuffer(req.body) ||
    req.body.length !== query.size
  ) {
    throw new HttpError(
      400,
      'INVALID_FILE',
      '업로드 URL을 받을 때와 파일 형식이나 크기가 달라요.',
    );
  }

  await localDiskStorage.write(key, req.body, query.type);
  res.status(200).end();
}
