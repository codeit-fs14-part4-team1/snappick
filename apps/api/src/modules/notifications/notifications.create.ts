import type { Prisma } from '../../generated/prisma/client.js';
import type { NotiTargetType, NotiType } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';

/**
 * 다른 파트에서 호출하는 알림 생성 함수
 * 원래 작업과 함께 저장하려면 트랜잭션 클라이언트(tx)를 마지막 인자로 넘긴다
 */
type Db = Prisma.TransactionClient;

const TARGET_TYPES: Record<NotiType, NotiTargetType> = {
  NEW_MESSAGE: 'CHAT_ROOM',
  NEW_INQUIRY: 'CHAT_ROOM',
  NEW_QUOTE: 'CHAT_ROOM',
  RESERVATION_CONFIRMED: 'RESERVATION',
  SHOOT_REMINDER: 'RESERVATION',
  DELIVERY_COMPLETED: 'RESERVATION',
  NEW_REVIEW: 'PHOTOGRAPHER_PROFILE',
  CANCEL_REQUESTED: 'RESERVATION',
  CANCEL_REJECTED: 'RESERVATION',
  RESERVATION_CANCELED: 'RESERVATION',
};

// 유형별 문구. NT-01: 메시지 내용은 넣지 않는다
export const notificationMessages = {
  newMessage: (senderName: string) => `${senderName}님이 메시지를 보냈어요.`,
  newInquiry: (userName: string) => `${userName}님이 문의를 보냈어요.`,
  newQuote: (photographerName: string) =>
    `${photographerName}님이 견적을 보냈어요.`,
  reservationConfirmed: () => '예약이 확정됐어요.',
  shootTomorrow: () => '내일 촬영이 있어요.',
  shootToday: () => '오늘 촬영이 있어요.',
  deliveryCompleted: (photographerName: string) =>
    `${photographerName}님이 결과물을 보냈어요.`,
  newReview: () => '새 리뷰가 등록됐어요.',
  cancelRequested: (userName: string) =>
    `${userName}님이 예약 취소를 요청했어요.`,
  cancelRejected: () => '예약 취소 요청이 반려됐어요.',
  reservationCanceled: () => '예약이 취소됐어요.',
};

type NewNotification = {
  accountId: string;
  type: NotiType;
  targetId: string;
  message: string;
};

export function createNotification(input: NewNotification, db: Db = prisma) {
  return db.notifications.create({
    data: {
      auth_account_id: input.accountId,
      type: input.type,
      target_type: TARGET_TYPES[input.type],
      target_id: input.targetId,
      message: input.message,
    },
  });
}

type MessageNotification = {
  recipientAccountId: string;
  chatRoomId: string;
  senderName: string;
  /** 받는 사람이 채팅방을 보고 있으면 true. 판단 방법은 채팅 파트와 확정 필요 */
  isRecipientViewing?: boolean;
};

/**
 * 메시지 알림 (NT-01, NT-13)
 * 받는 사람이 방을 보고 있거나, 그 방에 안 읽은 메시지 알림이 있으면 만들지 않는다
 * 만들지 않았으면 null
 */
export async function createMessageNotification(
  input: MessageNotification,
  db: Db = prisma,
) {
  if (input.isRecipientViewing) {
    return null;
  }

  const create = async (tx: Db) => {
    // 같은 방의 메시지가 동시에 와도 알림이 하나만 생기도록 차례대로 처리한다
    const lockKey = `noti:${input.recipientAccountId}:${input.chatRoomId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    const unread = await tx.notifications.findFirst({
      where: {
        auth_account_id: input.recipientAccountId,
        type: 'NEW_MESSAGE',
        target_id: input.chatRoomId,
        read_at: null,
      },
      select: { id: true },
    });
    if (unread) {
      return null;
    }
    return createNotification(
      {
        accountId: input.recipientAccountId,
        type: 'NEW_MESSAGE',
        targetId: input.chatRoomId,
        message: notificationMessages.newMessage(input.senderName),
      },
      tx,
    );
  };

  // 잠금은 트랜잭션 안에서만 유지된다. tx를 받았으면 그대로 쓴다
  return '$transaction' in db
    ? (db as typeof prisma).$transaction(create)
    : create(db);
}

/**
 * 채팅방을 읽을 때 호출한다. 그 방의 메시지 알림도 읽음 처리해야 다음 메시지에 알림이 다시 생긴다 (NT-13)
 */
export async function readMessageNotifications(
  accountId: string,
  chatRoomId: string,
  db: Db = prisma,
) {
  const { count } = await db.notifications.updateMany({
    where: {
      auth_account_id: accountId,
      type: 'NEW_MESSAGE',
      target_id: chatRoomId,
      read_at: null,
    },
    data: { read_at: new Date() },
  });
  return count;
}

const HOUR_MS = 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * HOUR_MS;

// 촬영일 오전 6시(한국 시간)
function shootDayMorning(shootAt: Date): Date {
  const kst = new Date(shootAt.getTime() + KST_OFFSET_MS);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 6) -
      KST_OFFSET_MS,
  );
}

type ShootReminders = {
  reservationId: string;
  shootAt: Date;
  /** 일반 사용자와 작가의 계정 ID */
  accountIds: string[];
};

/**
 * 촬영일 알림 예약 (NT-06): D-1, D-0 오전 6시(한국 시간)
 * 예약 확정 때 호출한다. 다시 호출하면 보내지 않은 알림을 새 일정으로 바꾼다
 * 이미 지난 시각이나 촬영 시작 이후 시각은 만들지 않는다
 * 목록 순서가 맞도록 created_at을 보낼 시각으로 저장한다
 */
export async function scheduleShootReminders(
  input: ShootReminders,
  db: Db = prisma,
) {
  await cancelShootReminders(input.reservationId, db);

  const now = Date.now();
  const today = shootDayMorning(input.shootAt);
  const schedule = [
    {
      at: new Date(today.getTime() - 24 * HOUR_MS),
      message: notificationMessages.shootTomorrow(),
    },
    { at: today, message: notificationMessages.shootToday() },
  ].filter(
    ({ at }) => at.getTime() > now && at.getTime() < input.shootAt.getTime(),
  );

  const { count } = await db.notifications.createMany({
    data: input.accountIds.flatMap((accountId) =>
      schedule.map(({ at, message }) => ({
        auth_account_id: accountId,
        type: 'SHOOT_REMINDER' as const,
        target_type: TARGET_TYPES.SHOOT_REMINDER,
        target_id: input.reservationId,
        message,
        scheduled_at: at,
        created_at: at,
      })),
    ),
  });
  return count;
}

/**
 * 예약 취소 때 호출한다. 아직 보내지 않은 촬영일 알림을 지운다
 */
export async function cancelShootReminders(
  reservationId: string,
  db: Db = prisma,
) {
  const { count } = await db.notifications.deleteMany({
    where: {
      type: 'SHOOT_REMINDER',
      target_id: reservationId,
      scheduled_at: { gt: new Date() },
    },
  });
  return count;
}
