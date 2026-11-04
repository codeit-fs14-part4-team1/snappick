import express, {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import {
  authenticate,
  requireAccountType,
} from '../../middlewares/authenticate.js';
import {
  createUploadUrlsHandler,
  putLocalUploadHandler,
  registerPhotosHandler,
} from './uploads.controller.js';
import { HttpError } from '../../utils/http-error.js';
import { MAX_FILE_SIZE } from './uploads.schema.js';

// 사진 업로드는 작가만 (PF-13)
const photographerOnly = [authenticate, requireAccountType('PHOTOGRAPHER')];

// app.use('/me/photos', myPhotoUploadsRouter)
export const myPhotoUploadsRouter: Router = Router();

myPhotoUploadsRouter.post(
  '/upload-urls',
  ...photographerOnly,
  createUploadUrlsHandler,
);
myPhotoUploadsRouter.post('/', ...photographerOnly, registerPhotosHandler);

// 개발용 로컬 저장소 (STORAGE_DRIVER=local일 때만 연결)
// app.use(LOCAL_UPLOAD_PATH, localUploadRouter)
export const localUploadRouter: Router = Router();

localUploadRouter.put(
  '/*key',
  express.raw({ type: () => true, limit: MAX_FILE_SIZE }),
  putLocalUploadHandler,
);

// express.raw의 용량 초과 오류를 S3와 같은 파일 오류로 돌려준다
localUploadRouter.use(
  (err: unknown, _req: Request, _res: Response, next: NextFunction) => {
    const tooLarge = (err as { type?: string }).type === 'entity.too.large';
    next(
      tooLarge
        ? new HttpError(
            400,
            'INVALID_FILE',
            '파일은 20MB 이하만 올릴 수 있어요.',
          )
        : err,
    );
  },
);
