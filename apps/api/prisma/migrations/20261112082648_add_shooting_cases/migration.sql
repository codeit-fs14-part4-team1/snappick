/*
  Warnings:

  - A unique constraint covering the columns `[shooting_case_id,version]` on the table `quotes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `shooting_case_id` to the `quotes` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "quotes_chat_room_id_version_key";

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "shooting_case_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "shooting_cases" (
    "id" UUID NOT NULL,
    "chat_room_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shooting_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shooting_cases_chat_room_id_idx" ON "shooting_cases"("chat_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_shooting_case_id_version_key" ON "quotes"("shooting_case_id", "version");

-- AddForeignKey
ALTER TABLE "shooting_cases" ADD CONSTRAINT "shooting_cases_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_shooting_case_id_fkey" FOREIGN KEY ("shooting_case_id") REFERENCES "shooting_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
