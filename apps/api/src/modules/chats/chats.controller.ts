import type { Request, Response } from 'express';
import { createChat } from './chats.service.js';
import { getAuth } from '../../middlewares/authenticate.js';

export async function createChatHandler(req: Request, res: Response) {
  const auth = getAuth(req);
  const accountId = auth.accountId;

  const photographerId = req.body.photographerId;
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
