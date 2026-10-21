import express, { type Express } from 'express';
import cors from 'cors';

export const app: Express = express();

app.use(
  cors({
    origin: process.env.ORIGIN || 'http://localhost:3000',
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SnapPick API' });
});
