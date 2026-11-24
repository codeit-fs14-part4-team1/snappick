-- 작가가 유저의 취소 요청을 수락할 때의 사유 (대기·반려·작가 직접 취소는 null)

-- AlterTable
ALTER TABLE "reservation_cancel_requests" ADD COLUMN "accept_reason" TEXT;
