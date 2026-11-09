import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { decodeCursor, encodeCursor } from '../../utils/cursor.js';
import { HttpError } from '../../utils/http-error.js';

type PageQuery = { cursor?: string | undefined; limit: number };

// 새 알림이 생겨도 페이지가 밀리지 않도록 마지막 항목의 시각과 ID를 커서로 쓴다
function readCursor(cursor: string): { createdAt: Date; id: string } {
  const { t, i } = decodeCursor(cursor);
  const createdAt = new Date(typeof t === 'string' ? t : NaN);
  if (typeof i !== 'string' || Number.isNaN(createdAt.getTime())) {
    throw new HttpError(400, 'INVALID_CURSOR', '목록을 다시 불러와 주세요.');
  }
  return { createdAt, id: i };
}

// 예약 알림은 보낼 시각이 지난 뒤에만 사용자에게 보인다
const visibleNow = (): Prisma.notificationsWhereInput => ({
  OR: [{ scheduled_at: null }, { scheduled_at: { lte: new Date() } }],
});

/**
 * 알림 목록 (GET /me/notifications)
 * 최신순. scheduled_at이 있으면 그 시각이 지난 알림만 보여 준다
 */
export async function getNotifications(accountId: string, query: PageQuery) {
  const conditions = [visibleNow()];
  if (query.cursor) {
    const { createdAt, id } = readCursor(query.cursor);
    conditions.push({
      OR: [
        { created_at: { lt: createdAt } },
        { created_at: createdAt, id: { lt: id } },
      ],
    });
  }

  const rows = await prisma.notifications.findMany({
    where: { auth_account_id: accountId, AND: conditions },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);

  return {
    items: page.map((row) => ({
      notificationId: row.id,
      type: row.type,
      targetType: row.target_type,
      targetId: row.target_id,
      message: row.message,
      read: row.read_at !== null,
      createdAt: row.created_at.toISOString(),
    })),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ t: last.created_at.toISOString(), i: last.id })
        : null,
  };
}

/**
 * 안 읽은 알림 여부 (GET /me/notifications/has-unread)
 */
export async function hasUnreadNotifications(accountId: string) {
  const unread = await prisma.notifications.findFirst({
    where: { auth_account_id: accountId, read_at: null, ...visibleNow() },
    select: { id: true },
  });
  return { hasUnread: unread !== null };
}

/**
 * 알림 읽음 처리 (PATCH /me/notifications/{notificationId}/read)
 * 이미 읽은 알림은 처음 읽은 시각을 그대로 돌려준다
 */
export async function readNotification(
  accountId: string,
  notificationId: string,
) {
  const notFound = () =>
    new HttpError(404, 'NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없어요.');

  // 아직 보낼 시각이 안 된 알림은 없는 알림으로 본다
  const notification = await prisma.notifications.findFirst({
    where: { id: notificationId, ...visibleNow() },
    select: { auth_account_id: true },
  });
  if (!notification) {
    throw notFound();
  }
  if (notification.auth_account_id !== accountId) {
    throw new HttpError(403, 'FORBIDDEN', '권한이 없어요.');
  }

  await prisma.notifications.updateMany({
    where: { id: notificationId, read_at: null },
    data: { read_at: new Date() },
  });
  const updated = await prisma.notifications.findUnique({
    where: { id: notificationId },
    select: { read_at: true },
  });
  if (!updated?.read_at) {
    throw notFound();
  }

  return {
    notificationId,
    read: true,
    readAt: updated.read_at.toISOString(),
  };
}
