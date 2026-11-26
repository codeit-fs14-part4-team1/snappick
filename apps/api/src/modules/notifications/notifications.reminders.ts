import type { Server } from 'socket.io';
import { prisma } from '../../lib/prisma.js';
import { KST_DAY_MS, shootDayMorning } from './notifications.create.js';
import { emitNotification } from './notifications.emit.js';

const RETRY_INTERVAL_MS = 1_000;
const RETRY_WINDOW_MS = 10_000;
const FAILURE_RETRY_DELAYS_MS = [30_000, 60_000, 300_000] as const;
const TIME_FROM_MORNING_TO_MIDNIGHT_MS = (KST_DAY_MS * 3) / 4;

type ShootReminder = { id: string; auth_account_id: string };

export function startShootReminderNotifications(io: Server) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  function schedule(scheduledAt: number) {
    const emitted = new Set<string>();
    const retryDeadline = scheduledAt + TIME_FROM_MORNING_TO_MIDNIGHT_MS;
    let retryUntil: number | undefined;
    let failures = 0;

    function scheduleNextDay() {
      const today = shootDayMorning(new Date()).getTime();
      schedule(Math.max(today, scheduledAt + KST_DAY_MS));
    }

    async function run() {
      const now = Date.now();
      if (now < scheduledAt) {
        timer = setTimeout(() => void run(), scheduledAt - now);
        return;
      }
      if (now >= retryDeadline) {
        scheduleNextDay();
        return;
      }

      // 느리게 완료된 예약 저장과 일시적인 DB 오류를 같은 발송 구간에서 다시 확인한다.
      retryUntil ??= now + RETRY_WINDOW_MS;
      try {
        await prisma.$transaction(async (tx) => {
          // 취소 트랜잭션의 FOR UPDATE와 충돌하는 잠금을 발송까지 유지한다.
          const reminders = await tx.$queryRaw<ShootReminder[]>`
            SELECT n.id, n.auth_account_id
            FROM notifications n
            JOIN reservations r ON r.id = CASE
              WHEN n.target_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
              THEN n.target_id::uuid
            END
            WHERE n.type = 'SHOOT_REMINDER'
              AND n.target_type = 'RESERVATION'
              AND n.scheduled_at = ${new Date(scheduledAt)}
              AND n.read_at IS NULL
              AND n.seen_at IS NULL
              AND r.status = 'CONFIRMED'
              AND r.shoot_at > (clock_timestamp() AT TIME ZONE 'UTC')
            FOR SHARE OF r
          `;
          if (stopped) return;

          for (const reminder of reminders) {
            if (emitted.has(reminder.id)) continue;
            emitNotification(io, [reminder]);
            emitted.add(reminder.id);
          }
        });
        failures = 0;
      } catch (error) {
        console.error('[job:shoot-reminders] failed', error);
        if (stopped) return;
        const delay = FAILURE_RETRY_DELAYS_MS[failures] ?? 300_000;
        failures += 1;
        if (Date.now() + delay < retryDeadline) {
          timer = setTimeout(() => void run(), delay);
        } else {
          scheduleNextDay();
        }
        return;
      }

      if (stopped) return;
      const retryAt = Date.now() + RETRY_INTERVAL_MS;
      if (retryAt <= retryUntil && retryAt < retryDeadline) {
        timer = setTimeout(() => void run(), RETRY_INTERVAL_MS);
      } else {
        scheduleNextDay();
      }
    }

    timer = setTimeout(() => void run(), Math.max(0, scheduledAt - Date.now()));
  }

  // 오전 6시 이후 시작하면 오늘 공개된 알림을 확인한다.
  schedule(shootDayMorning(new Date()).getTime());
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
