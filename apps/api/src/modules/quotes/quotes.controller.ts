import type { Request, Response } from 'express';
import type { Server } from 'socket.io';

import { getAuth } from '../../middlewares/authenticate.js';
import { createQuoteSchema } from './quotes.schema.js';
import { createQuote } from './quotes.service.js';

export async function createQuoteHandler(req: Request, res: Response) {
  const auth = getAuth(req);

  const input = createQuoteSchema.parse(req.body);

  // 견적과 채팅 메시지 저장
  const { quote, message } = await createQuote(auth.accountId, input);

  // 견적 응답 데이터 구성
  const quoteData = {
    id: quote.id,
    chatRoomId: quote.chat_room_id,
    shootingCaseId: quote.shooting_case_id,
    version: quote.version,
    productName: quote.product_name,
    shootAt: quote.shoot_at,
    location: quote.location,
    durationMinutes: quote.duration_minutes,
    price: quote.price,
    photoCount: quote.photo_count,
    includesOriginal: quote.includes_original,
    additionalNotice: quote.additional_notice,
    commonNotice: quote.common_notice,
    createdAt: quote.created_at,
  };

  // 실시간으로 전달할 채팅 메시지 구성
  const messageData = {
    id: message.id,
    chatRoomId: message.chat_room_id,
    recipientAccountId: message.recipient_account_id,
    messageType: message.message_type,
    content: message.content,
    payload: message.payload,
    quote: quoteData,
    reservation: null,
    readAt: message.read_at,
    createdAt: message.created_at,
  };

  // 채팅방에 입장한 연결에 견적 메시지 전달
  const io: Server = req.app.get('io');

  io.to(`chat:${input.chatRoomId}`).emit('message:new', messageData);

  res.status(201).json(quoteData);
}
