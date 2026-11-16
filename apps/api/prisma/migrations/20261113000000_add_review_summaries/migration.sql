-- CreateEnum
CREATE TYPE "ReviewSummaryResult" AS ENUM ('OK', 'REFUSED', 'INVALID', 'ERROR');

-- CreateTable
CREATE TABLE "review_summaries" (
    "photographer_id" UUID NOT NULL,
    "summary" TEXT,
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "caution" JSONB,
    "source_review_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_key" TEXT,
    "model" TEXT,
    "prompt_version" TEXT,
    "generated_at" TIMESTAMP(3),
    "last_attempt_key" TEXT,
    "last_attempt_result" "ReviewSummaryResult",
    "last_attempt_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_summaries_pkey" PRIMARY KEY ("photographer_id")
);

-- AddForeignKey
ALTER TABLE "review_summaries" ADD CONSTRAINT "review_summaries_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "photographers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

