import 'dotenv/config';
import { app } from './app.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyAccessToken } from './utils/tokens.js';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.ORIGIN || 'http://localhost:3000',
  },
});

const PORT = Number(process.env.PORT) || 4000;

// socket: 접속하려는 클라이언트의 연결 정보
// handshake: 연결을 시작하면서 주고받는 정보
// verifyAccessToken으로 검증한 게정 정보를 socket.data.auth에 저장
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (typeof token !== 'string' || token.length === 0) {
    return next(new Error('UNAUTHORIZED'));
  }

  try {
    const auth = verifyAccessToken(token);
    socket.data.auth = auth;
  } catch {
    return next(new Error('UNAUTHORIZED'));
  }
  next();
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
});

httpServer.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
