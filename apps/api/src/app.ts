import express, { type Express } from 'express';
import { prisma } from './lib/prisma.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { chatsRouter } from './modules/chats/chats.routes.js';
import {
  photographerPhotosRouter,
  photosRouter,
} from './modules/feeds/feeds.routes.js';
import {
  myPickRouter,
  photoLikesRouter,
  photographerSavesRouter,
} from './modules/likes/likes.routes.js';
import {
  localUploadRouter,
  myPhotoUploadsRouter,
} from './modules/uploads/uploads.routes.js';
import { storageDriver } from './lib/storage/index.js';
import { LOCAL_UPLOAD_PATH } from './lib/storage/local-storage.js';
import { myPhotosRouter } from './modules/my-photos/my-photos.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { errorHandler } from './middlewares/error-handler.js';
import { HttpError } from './utils/http-error.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { usersRouter } from './modules/users/users.routes.js';
import { photographersRouter } from './modules/photographers/photographers.routes.js';
import { photographerProductsRouter } from './modules/products/products.routes.js';
import {
  photographerReviewsRouter,
  myReviewsRouter,
} from './modules/reviews/reviews.routes.js';
import { quotesRouter } from './modules/quotes/quotes.routes.js';

export const app: Express = express();

app.use(
  cors({
    origin: process.env.ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SnapPick API' });
});

//db 헬스체크
app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    console.error('Database health check failed:', error);

    res.status(503).json({
      status: 'error',
      database: 'unavailable',
    });
  }
});
app.use('/auth', authRouter);
app.use('/chats', chatsRouter);
app.use('/users', usersRouter);
app.use('/photos', photosRouter);
app.use('/photographers', photographerPhotosRouter);
app.use('/photographers', photographersRouter);
app.use('/photos', photoLikesRouter);
app.use('/photographers', photographerSavesRouter);
app.use('/photographers', photographerProductsRouter);
app.use('/me', myPickRouter);
app.use('/photographers', photographerReviewsRouter);
app.use('/me', myReviewsRouter);
app.use('/me/photos', myPhotoUploadsRouter);
if (storageDriver === 'local') {
  app.use(LOCAL_UPLOAD_PATH, localUploadRouter);
}
app.use('/me/photos', myPhotosRouter);
app.use('/me/notifications', notificationsRouter);
app.use('/quotes', quotesRouter);

// 반드시 해당 주석 위에 라우터들을 배치할 것
app.use((_req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', '요청한 경로를 찾을 수 없습니다.'));
});
app.use(errorHandler);
