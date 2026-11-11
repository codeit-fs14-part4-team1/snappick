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

//채팅방 목록 조회
export async function getChats(accountId: string) {
  const account = await prisma.auth_accounts.findUnique({
    where: {
      id: accountId,
    },
    include: {
      user: true,
      photographer: true,
    },
  });

  if (!account) {
    throw new HttpError(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  }

  let where: Prisma.chat_roomsWhereInput;

  if (account.account_type === 'USER') {
    if (!account.user) {
      throw new HttpError(
        404,
        'PROFILE_NOT_FOUND',
        '사용자 정보를 찾을 수 없습니다.',
      );
    }

    where = {
      user_id: account.user.id,
    };
  } else {
    if (!account.photographer) {
      throw new HttpError(
        404,
        'PROFILE_NOT_FOUND',
        '작가 정보를 찾을 수 없습니다.',
      );
    }

    where = {
      photographer_id: account.photographer.id,
      chatMessage: {
        some: {},
      },
    };
  }

  const chats = await prisma.chat_rooms.findMany({
    where,
    orderBy: [{ last_message_at: 'desc' }, { id: 'desc' }],
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          profile_image_url: true,
        },
      },
      photographer: {
        select: {
          id: true,
          nickname: true,
          profile_image_url: true,
        },
      },
      chatMessage: {
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          id: true,
          message_type: true,
          content: true,
          created_at: true,
        },
      },
      _count: {
        select: {
          chatMessage: {
            where: {
              recipient_account_id: accountId,
              read_at: null,
            },
          },
        },
      },
    },
  });

  const items = chats.map((chat) => {
    const partner =
      account.account_type === 'USER' ? chat.photographer : chat.user;

    const lastMessage = chat.chatMessage[0];

    return {
      id: chat.id,
      partner: {
        id: partner?.id ?? null,
        nickname: partner?.nickname ?? null,
        profileImageUrl: partner?.profile_image_url ?? null,
        isWithdrawn: partner === null,
      },
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            messageType: lastMessage.message_type,
            content: lastMessage.content,
            createdAt: lastMessage.created_at,
          }
        : null,
      unreadCount: chat._count.chatMessage,
      lastMessageAt: chat.last_message_at,
    };
  });
  return { items };
}

export async function sendMessage(
  accountId: string,
  chatRoomId: string,
  content: string,
) {
  const chatRoom = await prisma.chat_rooms.findUnique({
    where: {
      id: chatRoomId,
    },
    include: {
      user: {
        select: { auth_account_id: true },
      },
      photographer: {
        select: { auth_account_id: true },
      },
    },
  });

  if (!chatRoom) {
    throw new HttpError(
      404,
      'CHAT_ROOM_NOT_FOUND',
      '존재하지 않는 문의입니다.',
    );
  }

  const userAccountId = chatRoom.user?.auth_account_id;
  const photographerAccountId = chatRoom.photographer?.auth_account_id;

  if (accountId !== userAccountId && accountId !== photographerAccountId) {
    throw new HttpError(
      403,
      'CHAT_ROOM_ACCESS_DENIED',
      '해당 문의에 접근할 권한이 없습니다.',
    );
  }

  const recipientAccountId =
    accountId === userAccountId ? photographerAccountId : userAccountId;

  if (!recipientAccountId) {
    throw new HttpError(
      422,
      'PARTNER_WITHDRAWN',
      '상대방이 탈퇴하여 메시지를 보낼 수 없습니다.',
    );
  }

  const message = await prisma.$transaction(async (tx) => {
    const savedMessage = await tx.chat_messages.create({
      data: {
        chat_room_id: chatRoomId,
        recipient_account_id: recipientAccountId,
        message_type: 'TEXT',
        content,
      },
    });
    await tx.chat_rooms.updateMany({
      where: {
        id: chatRoomId,
        last_message_at: { lt: savedMessage.created_at },
      },
      data: {
        last_message_at: savedMessage.created_at,
      },
    });
    return savedMessage;
  });
  return message;
}

//채팅 목록
export async function getMessages(
  accountId: string,
  chatRoomId: string,
  limit: number,
  cursor?: string,
) {
  const chatRoom = await prisma.chat_rooms.findUnique({
    where: {
      id: chatRoomId,
    },
    include: {
      user: {
        select: { auth_account_id: true },
      },
      photographer: {
        select: { auth_account_id: true },
      },
    },
  });

  if (!chatRoom) {
    throw new HttpError(
      404,
      'CHAT_ROOM_NOT_FOUND',
      '존재하지 않는 문의입니다.',
    );
  }

  const userAccountId = chatRoom.user?.auth_account_id;
  const photographerAccountId = chatRoom.photographer?.auth_account_id;

  if (accountId !== userAccountId && accountId !== photographerAccountId) {
    throw new HttpError(
      403,
      'CHAT_ROOM_ACCESS_DENIED',
      '해당 문의에 접근할 권한이 없습니다.',
    );
  }

  const cursorMessage = cursor
    ? await prisma.chat_messages.findUnique({
        where: {
          id: cursor,
          chat_room_id: chatRoomId,
        },
      })
    : null;

  if (cursor && !cursorMessage) {
    throw new HttpError(400, 'INVALID_CURSOR', '잘못된 선택자입니다.');
  }

  const where: Prisma.chat_messagesWhereInput = {
    chat_room_id: chatRoomId,
  };

  if (cursorMessage) {
    where.OR = [
      {
        created_at: { lt: cursorMessage.created_at },
      },
      {
        created_at: cursorMessage.created_at,
        id: { lt: cursorMessage.id },
      },
    ];
  }

  const messages = await prisma.chat_messages.findMany({
    where,
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = messages.length > limit;
  const pageMessages = messages.slice(0, limit);

  const items = pageMessages.reverse().map((message) => ({
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
  }));

  const nextCursor = hasNext ? (items[0]?.id ?? null) : null;

  return {
    items,
    nextCursor,
    hasNext,
  };
}

export async function checkChatRoomAccess(
  accountId: string,
  chatRoomId: string,
) {
  const chatRoom = await prisma.chat_rooms.findUnique({
    where: {
      id: chatRoomId,
    },
    include: {
      user: {
        select: { auth_account_id: true },
      },
      photographer: {
        select: { auth_account_id: true },
      },
    },
  });

  if (!chatRoom) {
    throw new HttpError(
      404,
      'CHAT_ROOM_NOT_FOUND',
      '존재하지 않는 문의입니다.',
    );
  }

  const userAccountId = chatRoom.user?.auth_account_id;
  const photographerAccountId = chatRoom.photographer?.auth_account_id;

  if (accountId !== userAccountId && accountId !== photographerAccountId) {
    throw new HttpError(
      403,
      'CHAT_ROOM_ACCESS_DENIED',
      '해당 문의에 접근할 권한이 없습니다.',
    );
  }
}

export async function markChatAsRead(
  accountId: string,
  chatRoomId: string,
  lastReadMessageId: string,
) {
  await checkChatRoomAccess(accountId, chatRoomId);

  const lastReadMessage = await prisma.chat_messages.findFirst({
    where: {
      id: lastReadMessageId,
      chat_room_id: chatRoomId,
    },
  });

  if (!lastReadMessage) {
    throw new HttpError(
      404,
      'MESSAGE_NOT_FOUND',
      '해당 문의의 메시지를 찾을 수 없습니다.',
    );
  }

  const readAt = new Date();

  const updated = await prisma.chat_messages.updateMany({
    where: {
      chat_room_id: chatRoomId,
      recipient_account_id: accountId,
      read_at: null,
      OR: [
        {
          created_at: { lt: lastReadMessage.created_at },
        },
        {
          created_at: lastReadMessage.created_at,
          id: { lte: lastReadMessage.id },
        },
      ],
    },

    data: {
      read_at: readAt,
    },
  });

  return {
    lastReadMessageId,
    updatedCount: updated.count,
    readAt,
  };
}
