import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(
    cors({
        origin: process.env.ORIGIN || 'http://localhost:3000',
    }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'SnapPick API' });
});

app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
});
