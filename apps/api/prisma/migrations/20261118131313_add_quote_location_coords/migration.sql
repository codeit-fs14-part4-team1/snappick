-- 견적 촬영 장소 좌표 (네이버 지도 표시용)
-- 기존 견적에는 좌표가 없으므로 nullable로 추가 → 채우기 → NOT NULL 순서로 적용한다

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN "location_lat" DOUBLE PRECISION,
ADD COLUMN "location_lng" DOUBLE PRECISION;

-- 기존 견적은 서울시청 좌표로 채운다 (시드 견적은 db:seed 재실행 시 실제 좌표로 갱신)
UPDATE "quotes" SET "location_lat" = 37.5666, "location_lng" = 126.9784
WHERE "location_lat" IS NULL OR "location_lng" IS NULL;

ALTER TABLE "quotes" ALTER COLUMN "location_lat" SET NOT NULL,
ALTER COLUMN "location_lng" SET NOT NULL;
