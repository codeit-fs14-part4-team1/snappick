-- 구매 확정 시각 (유저가 직접 확정하거나 자동 확정된 시각, 확정 전이면 null)

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "purchase_confirmed_at" TIMESTAMP(3);

-- 이미 확정된 예약은 마지막 수정 시각으로 채운다 (확정 이후 예약 행을 수정하는 기능이 없다)
UPDATE "reservations" SET "purchase_confirmed_at" = "updated_at"
WHERE "status" = 'PURCHASE_CONFIRMED';
