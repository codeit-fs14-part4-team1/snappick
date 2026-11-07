import 'dotenv/config';
import { app } from './app.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyAccessToken } from './utils/tokens.js';
import { chatRoomParamsSchema } from './modules/chats/chats.schema.js';
import { checkChatRoomAccess } from './modules/chats/chats.service.js';
import { HttpError } from './utils/http-error.js';

const httpServer = createServer(app);

// socket.io 서버를 만듬. io는 접속한 소켓과 room을 관리.
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ORIGIN || 'http://localhost:3000',
  },
});

// Express 앱에 'io'라는 이름으로 socket.io 객체를 등록
// 'io'는 이름이고, io는 실제 객체
app.set('io', io);

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

// io.on('connection', ...) 서버에 새 연결이 들어와서 누군가 연결되면 실행
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // socket.on('이름', 함수)  는 이벤트가 오면 실행할 함수 등록
  // 입장 요청을 보내면 실행
  socket.on('chat:join', async (payload: unknown) => {
    const result = chatRoomParamsSchema.safeParse(payload);

    // socket.emit('이름', 데이터) 는 상대편에 이벤트 전송
    if (!result.success) {
      socket.emit('chat:error', {
        code: 'VALIDATION_FAILED',
        message: 'chatRoomId는 UUID여야 합니다.',
      });
      return;
    }
    const chatRoomId = result.data.chatRoomId;

    try {
      await checkChatRoomAccess(socket.data.auth.accountId, chatRoomId);

      await socket.join(`chat:${chatRoomId}`);

      socket.emit('chat:joined', {
        chatRoomId,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        socket.emit('chat:error', {
          code: error.code,
          message: error.message,
        });
      } else {
        console.error(error);

        socket.emit('chat:error', {
          code: 'INTERNAL_ERROR',
          message: '채팅방 입장 중 오류가 발생했습니다.',
        });
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
