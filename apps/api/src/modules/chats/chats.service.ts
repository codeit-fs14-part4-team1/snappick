import { prisma } from '../../lib/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';

//사용자 조회
export async function createChat(accountId: string, photographerId: string) {
  const account = await prisma.auth_accounts.findUnique({
    where: {
      id: accountId,
    },
    include: {
      user: true,
    },
  });

  if (!account) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }

  if (account.account_type !== 'USER') {
    throw new HttpError(
      403,
      'ACCOUNT_TYPE_NOT_ALLOWED',
      '일반 사용자만 문의를 시작할 수 있습니다.',
    );
  }

  // 로그인 계정에 연결된 users가 존재하느지 여부 확인
  // 유저의 사진 등의 프로필이 아님
  if (!account.user) {
    throw new HttpError(404, 'PROFILE_NOT_FOUND', '프로필을 찾을 수 없습니다.');
  }

  const userId = account.user.id;

  //작가조회
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

  //작가 프로필 완료 여부 조회
  if (
    !photographer.profile_image_url?.trim() ||
    !photographer.nickname.trim() ||
    !photographer.introduction?.trim() ||
    photographer.regions.length === 0 ||
    photographer.categories.length === 0
  ) {
    throw new HttpError(
      400,
      'PHOTOGRAPHER_NOT_READY',
      '아직 문의를 받을 수 없는 작가입니다.',
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
  try {
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
  } catch (error) {
    // 다른 요청이 먼저 같은 채팅방을 생성했는지 확인
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
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
    }
    throw error;
  }
}
