import type { Server } from 'socket.io';

type EmittedNotification = { id: string; auth_account_id: string };

export function emitNotification(
  io: Server,
  notifications: EmittedNotification[],
) {
  for (const notification of notifications) {
    io.to(`account:${notification.auth_account_id}`).emit('notification:new', {
      notificationId: notification.id,
    });
  }
}
