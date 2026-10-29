import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';

export async function createChat(userId: string, photographerId: string) {
  const photographer = await prisma.photographers.findUnique({
    where: {
      id: photographerId,
    },
  });

  if (!photographer) {
    throw new HttpError(
      404,
      'PHOTOGRAPHER_NOT_FOUND',
      '존재하지 않는 사진작가입니다.',
    );
  }

  //기존 채팅방
  const existingChat = await prisma.chat_rooms.findUnique({
    where: {
      user_id_photographer_id: {
        user_id: userId,
        photographer_id: photographerId,
      },
    },
  });

  if (existingChat) {
    return {
      chatRoom: existingChat,
      photographer,
      isNew: false,
    };
  }

  //새로운 채팅방
  const newChat = await prisma.chat_rooms.create({
    data: {
      user_id: userId,
      photographer_id: photographerId,
    },
  });

  return {
    chatRoom: newChat,
    photographer,
    isNew: true,
  };
}
