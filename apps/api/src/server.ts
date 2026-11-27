import 'dotenv/config';
import { app } from './app.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { verifySocketAccessToken } from './utils/tokens.js';
import { chatRoomParamsSchema } from './modules/chats/chats.schema.js';
import { checkChatRoomAccess } from './modules/chats/chats.service.js';
import { HttpError } from './utils/http-error.js';
import { startIntervalJob } from './utils/interval-job.js';
import { emitNotification } from './modules/notifications/notifications.emit.js';
import { startShootReminderNotifications } from './modules/notifications/notifications.reminders.js';
import { setChatViewerSource } from './modules/notifications/notifications.viewers.js';
import {
  PENDING_STALE_MS,
  reconcilePendingPayments,
} from './modules/payments/payments.settlement.js';
import { advanceReservationStatuses } from './modules/reservations/reservations.service.js';
import { VALUE_SCORE_JOB_INTERVAL_MS } from './modules/recommendations/value-score.config.js';
import { refreshValueScores } from './modules/recommendations/value-score.service.js';

const RESERVATION_STATUS_JOB_INTERVAL_MS = 10 * 60 * 1000;
const PAYMENT_RECONCILE_JOB_INTERVAL_MS = 60 * 1000;

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
// 알림을 만들 때 채팅방을 보고 있는 사람을 확인하는 데 쓴다
setChatViewerSource(io);

const PORT = Number(process.env.PORT) || 4000;

// socket: 접속하려는 클라이언트의 연결 정보
// handshake: 연결을 시작하면서 주고받는 정보
// verifySocketAccessToken으로 검증한 게정 정보를 socket.data.auth에 저장
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (typeof token !== 'string' || token.length === 0) {
    return next(new Error('UNAUTHORIZED'));
  }

  try {
    const auth = verifySocketAccessToken(token);
    socket.data.auth = auth;
  } catch {
    return next(new Error('UNAUTHORIZED'));
  }
  next();
});

// io.on('connection', ...) 서버에 새 연결이 들어와서 누군가 연결되면 실행
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  const accountId = socket.data.auth.accountId;
  void socket.join(`account:${accountId}`);

  // 토큰 만료 시간 계산
  const expiresAtMs = socket.data.auth.expiresAt * 1000;

  let expiryTimer: ReturnType<typeof setTimeout>;

  function scheduleExpiry() {
    const remainingMs = expiresAtMs - Date.now();

    if (remainingMs <= 0) {
      socket.emit('auth:expired', {
        code: 'ACCESS_TOKEN_EXPIRED',
        message: '액세스 토큰이 만료되었습니다.',
      });

      socket.disconnect(true);
      return;
    }

    // 노드js setTimeout()에 한 번에 지정할 수 있는 최대 지연 시간
    // 2,147,483,647밀리초..약 24.8일 정도
    // 최대 시간 또는 remainingMs 중 적은거니 주로 remainingMs가 선택됨
    expiryTimer = setTimeout(scheduleExpiry, Math.min(remainingMs, 2147483647));
  }

  scheduleExpiry();

  socket.on('disconnect', () => {
    clearTimeout(expiryTimer);
  });

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
          chatRoomId,
          code: error.code,
          message: error.message,
        });
      } else {
        console.error(error);

        socket.emit('chat:error', {
          chatRoomId,
          code: 'INTERNAL_ERROR',
          message: '채팅방 입장 중 오류가 발생했습니다.',
        });
      }
    }
  });

  // 이 연결에서 지금 보고 있는 채팅방 (한 번에 하나)
  const viewing: { chatRoomId: string | null } = { chatRoomId: null };

  // 채팅방 화면을 보기 시작하면 실행
  // chat:join은 목록의 모든 방에 입장하므로 보고 있는 방은 따로 구분한다
  socket.on('chat:view', async (payload: unknown) => {
    const result = chatRoomParamsSchema.safeParse(payload);

    if (!result.success) {
      socket.emit('chat:error', {
        code: 'VALIDATION_FAILED',
        message: 'chatRoomId는 UUID여야 합니다.',
      });
      return;
    }
    const chatRoomId = result.data.chatRoomId;

    // 다른 방을 보고 있었다면 그 방에서 나간다
    if (viewing.chatRoomId && viewing.chatRoomId !== chatRoomId) {
      void socket.leave(`viewing:${viewing.chatRoomId}`);
    }
    viewing.chatRoomId = chatRoomId;

    try {
      await checkChatRoomAccess(socket.data.auth.accountId, chatRoomId);

      // 확인하는 사이 방을 나갔거나 옮겼으면 입장하지 않는다
      if (viewing.chatRoomId !== chatRoomId) return;

      await socket.join(`viewing:${chatRoomId}`);

      socket.emit('chat:viewed', {
        chatRoomId,
      });
    } catch (error) {
      if (viewing.chatRoomId === chatRoomId) {
        viewing.chatRoomId = null;
        void socket.leave(`viewing:${chatRoomId}`);
      }

      if (error instanceof HttpError) {
        socket.emit('chat:error', {
          chatRoomId,
          code: error.code,
          message: error.message,
        });
      } else {
        console.error(error);

        socket.emit('chat:error', {
          chatRoomId,
          code: 'INTERNAL_ERROR',
          message: '채팅방 보기 처리 중 오류가 발생했습니다.',
        });
      }
    }
  });

  // 채팅방 화면을 벗어나면 실행 (연결이 끊기면 자동으로 나가진다)
  socket.on('chat:unview', (payload: unknown) => {
    const result = chatRoomParamsSchema.safeParse(payload);

    if (!result.success) {
      socket.emit('chat:error', {
        code: 'VALIDATION_FAILED',
        message: 'chatRoomId는 UUID여야 합니다.',
      });
      return;
    }
    const chatRoomId = result.data.chatRoomId;

    // 이미 다른 방으로 옮겼다면 그 기록은 유지한다
    if (viewing.chatRoomId === chatRoomId) {
      viewing.chatRoomId = null;
    }
    void socket.leave(`viewing:${chatRoomId}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);

  startShootReminderNotifications(io);

  // 예약 상태 자동 전환 (촬영 완료, 구매 확정)
  startIntervalJob(
    'reservation-status',
    RESERVATION_STATUS_JOB_INTERVAL_MS,
    async () => {
      const result = await advanceReservationStatuses(new Date());
      if (Object.values(result).some((count) => count > 0)) {
        console.log('[job:reservation-status]', result);
      }
    },
  );

  // 추천 피드의 가치 점수 (하루 1번, 시작할 때도 1번)
  startIntervalJob('value-scores', VALUE_SCORE_JOB_INTERVAL_MS, async () => {
    console.log('[job:value-scores]', await refreshValueScores(new Date()));
  });

  // 처리 중에 멈춘 결제를 토스 상태에 맞춤
  // 시작 직후에는 이전 프로세스가 남긴 결제를 바로 처리하도록 모든 건을 확인
  let firstReconcile = true;
  startIntervalJob(
    'payment-reconcile',
    PAYMENT_RECONCILE_JOB_INTERVAL_MS,
    async () => {
      const minAgeMs = firstReconcile ? 0 : PENDING_STALE_MS;
      firstReconcile = false;
      const { counts, events } = await reconcilePendingPayments(
        new Date(),
        minAgeMs,
      );
      for (const { chatRoomId, notifications } of events) {
        emitNotification(io, notifications);
        if (chatRoomId) {
          io.to(`chat:${chatRoomId}`).emit('message:new', { chatRoomId });
        }
      }
      if (Object.values(counts).some((count) => count > 0)) {
        console.log('[job:payment-reconcile]', counts);
      }
    },
  );
});
