import type { Request, Response } from 'express';
import {
  createChat,
  getChats,
  getMessages,
  sendMessage,
  sendInquiry,
} from './chats.service.js';
import { getAuth } from '../../middlewares/authenticate.js';
import {
  chatRoomParamsSchema,
  createChatSchema,
  getMessagesQuerySchema,
  sendMessageSchema,
  sendInquirySchema,
} from './chats.schema.js';
import { HttpError } from '../../utils/http-error.js';
import type { Server } from 'socket.io';

export async function createChatHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const accountId = auth.accountId;

  const input = createChatSchema.parse(req.body);
  const photographerId = input.photographerId;
  const { chatRoom, photographer, isNew } = await createChat(
    accountId,
    photographerId,
  );

  res.status(isNew ? 201 : 200).json({
    chatRoomId: chatRoom.id,
    isNew,
    photographer: {
      id: photographer.id,
      nickname: photographer.nickname,
      profileImageUrl: photographer.profile_image_url,
    },
    createdAt: chatRoom.created_at,
  });
}

export async function getChatsHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const result = await getChats(auth.accountId);

  res.status(200).json(result);
}

export async function sendMessageHandler(req: Request, res: Response) {
  if (req.body?.messageType === 'INITIAL_REQUEST') {
    return sendInquiryHandler(req, res);
  }
  const auth = getAuth(req);
  const params = chatRoomParamsSchema.parse(req.params);
  const result = sendMessageSchema.safeParse(req.body);

  // 개별 오류 코드
  if (!result.success) {
    const isWrongMessageType = result.error.issues.some(
      (issue) => issue.path[0] === 'messageType',
    );

    if (isWrongMessageType) {
      throw new HttpError(400, 'INVALID_REQUEST', '잘못된 요청입니다.');
    }

    const isEmptyContent = result.error.issues.some(
      (issue) =>
        issue.path[0] === 'content' &&
        (issue.code === 'too_small' ||
          (issue.code === 'invalid_type' && req.body.content === undefined)),
    );

    if (isEmptyContent) {
      throw new HttpError(
        400,
        'EMPTY_MESSAGE_CONTENT',
        '메시지 내용을 입력해 주세요.',
      );
    }

    const isTooLongContent = result.error.issues.some(
      (issue) => issue.path[0] === 'content' && issue.code === 'too_big',
    );

    if (isTooLongContent) {
      throw new HttpError(
        400,
        'MESSAGE_TOO_LONG',
        '메시지는 최대 1,000자까지 입력할 수 있습니다.',
      );
    }

    throw new HttpError(400, 'INVALID_REQUEST', '잘못된 요청입니다.');
  }

  const input = result.data;

  const message = await sendMessage(
    auth.accountId,
    params.chatRoomId,
    input.content,
  );

  // 저장된 메시지를 채팅방 Room에 전달하기 위해
  // server.ts에서 생성해 Express 앱에 등록한 socket.io 서버 객체를 가져옴.
  const io: Server = req.app.get('io');

  const messageData = {
    id: message.id,
    chatRoomId: message.chat_room_id,
    recipientAccountId: message.recipient_account_id,
    messageType: message.message_type,
    content: message.content,
    payload: message.payload,
    quote: null,
    reservation: null,
    readAt: message.read_at,
    createdAt: message.created_at,
  };

  // 해당 방에 입장한 모든 연결에 새 메시지 전달
  io.to(`chat:${params.chatRoomId}`).emit('message:new', messageData);

  res.status(201).json(messageData);
}

export async function getMessagesHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const params = chatRoomParamsSchema.parse(req.params);
  const queryResult = getMessagesQuerySchema.safeParse(req.query);

  if (!queryResult.success) {
    const isInvalidCursor = queryResult.error.issues.some(
      (issue) => issue.path[0] === 'cursor',
    );

    if (isInvalidCursor) {
      throw new HttpError(400, 'INVALID_CURSOR', '잘못된 선택자입니다.');
    }

    throw queryResult.error;
  }
  const query = queryResult.data;

  const result = await getMessages(
    auth.accountId,
    params.chatRoomId,
    query.limit,
    query.cursor,
  );

  res.status(200).json(result);
}

// 초기 문의 정보 관련
async function sendInquiryHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const params = chatRoomParamsSchema.parse(req.params);
  const result = sendInquirySchema.safeParse(req.body);

  if (!result.success) {
    const isEmptyInquiry = result.error.issues.some(
      (issue) => issue.code === 'custom' && issue.path[0] === 'payload',
    );

    if (isEmptyInquiry) {
      throw new HttpError(
        400,
        'EMPTY_INITIAL_REQUEST',
        '촬영 정보를 하나 이상 입력해 주세요.',
      );
    }

    throw new HttpError(400, 'INVALID_REQUEST', '잘못된 요청입니다.');
  }

  const message = await sendInquiry(
    auth.accountId,
    params.chatRoomId,
    result.data.payload,
  );

  const io: Server = req.app.get('io');

  const messageData = {
    id: message.id,
    chatRoomId: message.chat_room_id,
    recipientAccountId: message.recipient_account_id,
    messageType: message.message_type,
    content: message.content,
    payload: message.payload,
    quote: null,
    reservation: null,
    readAt: message.read_at,
    createdAt: message.created_at,
  };

  io.to(`chat:${params.chatRoomId}`).emit('message:new', messageData);

  res.status(201).json(messageData);
}
