import express, { type Express } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { chatsRouter } from './modules/chats/chats.routes.js';
import { errorHandler } from './middlewares/error-handler.js';
import { HttpError } from './utils/http-error.js';

import cors from 'cors';

export const app: Express = express();

app.use(
  cors({
    origin: process.env.ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SnapPick API' });
});

app.use('/auth', authRouter);
app.use('/chats', chatsRouter);

// 반드시 해당 주석 위에 라우터들을 배치할 것
app.use((_req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', '요청한 경로를 찾을 수 없습니다.'));
});
app.use(errorHandler);
