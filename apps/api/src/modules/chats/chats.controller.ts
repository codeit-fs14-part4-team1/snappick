import type { Request, Response } from 'express';
import { createChat, getChats, sendMessage } from './chats.service.js';
import { getAuth } from '../../middlewares/authenticate.js';
import {
  chatRoomParamsSchema,
  createChatSchema,
  sendMessageSchema,
} from './chats.schema.js';
import { HttpError } from '../../utils/http-error.js';

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

  res.status(201).json({
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
  });
}
