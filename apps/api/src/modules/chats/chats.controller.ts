import type { Request, Response } from 'express';
import { createChat } from './chats.service.js';

export async function createChatHandler(req: Request, res: Response) {
  // 로컬 테스트용
  const userId = '00000000-0000-4000-8000-b00300000901';

  const photographerId = req.body.photographerId;
  const { chatRoom, photographer, isNew } = await createChat(
    userId,
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
