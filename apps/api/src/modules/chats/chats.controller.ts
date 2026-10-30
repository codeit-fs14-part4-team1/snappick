import type { Request, Response } from 'express';
import { createChat } from './chats.service.js';
import { getAuth } from '../../middlewares/authenticate.js';
import { createChatSchema } from './chats.schema.js';

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
