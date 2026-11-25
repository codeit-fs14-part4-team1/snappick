import type { Request, Response } from 'express';
import type { Server } from 'socket.io';

import { getAuth } from '../../middlewares/authenticate.js';
import {
  confirmPaymentSchema,
  preparePaymentSchema,
} from './payments.schema.js';
import {
  confirmPayment,
  getPaymentChatRoomId,
  preparePayment,
} from './payments.service.js';
import { HttpError } from '../../utils/http-error.js';
import { emitNotification } from '../notifications/notifications.emit.js';

// 소유자 확인을 마친 뒤 결제 상태가 바뀌었거나 처리 중인 오류
const PAYMENT_STATE_ERROR_CODES = new Set([
  'PAYMENT_PROCESSING',
  'PAYMENT_RETRY_REQUIRED',
  'PAYMENT_CANCELED',
]);

export async function preparePaymentHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const input = preparePaymentSchema.parse(req.body);

  const { reused, ...result } = await preparePayment(auth.accountId, input);

  res.status(reused ? 200 : 201).json(result);
}

export async function confirmPaymentHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const input = confirmPaymentSchema.parse(req.body);

  const io: Server = req.app.get('io');

  const { chatRoomId, notifications, ...result } = await confirmPayment(
    auth.accountId,
    input,
  ).catch(async (error: unknown) => {
    if (
      error instanceof HttpError &&
      PAYMENT_STATE_ERROR_CODES.has(error.code)
    ) {
      // 채팅의 결제·수정 버튼이 갱신되도록 신호만 보낸다
      const roomId = await getPaymentChatRoomId(input.orderId).catch(
        () => null,
      );
      if (roomId) {
        io.to(`chat:${roomId}`).emit('message:new', { chatRoomId: roomId });
      }
    }
    throw error;
  });

  emitNotification(io, notifications);
  if (chatRoomId) {
    io.to(`chat:${chatRoomId}`).emit('message:new', { chatRoomId });
  }
  res.status(200).json(result);
}
