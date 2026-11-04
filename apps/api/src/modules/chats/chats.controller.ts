import type { Request, Response } from 'express';
import { createChat, getChats, sendMessage } from './chats.service.js';
import { getAuth } from '../../middlewares/authenticate.js';
import {
  chatRoomParamsSchema,
  createChatSchema,
  sendMessageSchema,
} from './chats.schema.js';

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
  const input = sendMessageSchema.parse(req.body);

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
