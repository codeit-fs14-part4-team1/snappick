import express, { type Express } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { errorHandler } from './middlewares/error-handler.js';

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

app.use(errorHandler);
