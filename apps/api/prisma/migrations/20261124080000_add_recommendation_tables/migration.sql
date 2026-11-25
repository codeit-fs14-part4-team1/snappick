-- 추천 피드 테이블 (사용자 행동 기록, 사진·작가·사용자 feature, 사진 가치 점수)

-- CreateEnum
CREATE TYPE "FeatureAnalysisResult" AS ENUM ('OK', 'REFUSED', 'INVALID', 'ERROR');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('LIKE', 'UNLIKE', 'SAVE', 'UNSAVE', 'QUOTE', 'RESERVE', 'REVIEW');

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "InteractionType" NOT NULL,
    "photo_id" UUID,
    "photographer_id" UUID,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_features" (
    "photo_id" UUID NOT NULL,
    "subject" TEXT,
    "place" TEXT,
    "time" TEXT,
    "weather" TEXT,
    "light_source" TEXT,
    "light_direction" TEXT,
    "exposure" TEXT,
    "color" TEXT,
    "shot_size" TEXT,
    "angle" TEXT,
    "people_count" TEXT,
    "pose" TEXT,
    "gaze" TEXT,
    "mood" TEXT,
    "summary" TEXT,
    "model" TEXT,
    "prompt_version" TEXT,
    "analyzed_at" TIMESTAMP(3),
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "embedding_model" TEXT,
    "embedded_at" TIMESTAMP(3),
    "cluster_id" INTEGER,
    "last_attempt_result" "FeatureAnalysisResult",
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_features_pkey" PRIMARY KEY ("photo_id")
);

-- CreateTable
CREATE TABLE "photographer_features" (
    "photographer_id" UUID NOT NULL,
    "subject" TEXT,
    "place" TEXT,
    "time" TEXT,
    "weather" TEXT,
    "light_source" TEXT,
    "light_direction" TEXT,
    "exposure" TEXT,
    "color" TEXT,
    "shot_size" TEXT,
    "angle" TEXT,
    "people_count" TEXT,
    "pose" TEXT,
    "gaze" TEXT,
    "mood" TEXT,
    "summary" TEXT,
    "model" TEXT,
    "prompt_version" TEXT,
    "analyzed_at" TIMESTAMP(3),
    "source_photo_analyzed_at" TIMESTAMP(3),
    "last_attempt_result" "FeatureAnalysisResult",
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photographer_features_pkey" PRIMARY KEY ("photographer_id")
);

-- CreateTable
CREATE TABLE "user_features" (
    "user_id" UUID NOT NULL,
    "subject" TEXT,
    "place" TEXT,
    "time" TEXT,
    "weather" TEXT,
    "light_source" TEXT,
    "light_direction" TEXT,
    "exposure" TEXT,
    "color" TEXT,
    "shot_size" TEXT,
    "angle" TEXT,
    "people_count" TEXT,
    "pose" TEXT,
    "gaze" TEXT,
    "mood" TEXT,
    "summary" TEXT,
    "model" TEXT,
    "prompt_version" TEXT,
    "analyzed_at" TIMESTAMP(3),
    "source_interaction_at" TIMESTAMP(3),
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "embedding_model" TEXT,
    "embedded_at" TIMESTAMP(3),
    "previous_embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "previous_embedded_at" TIMESTAMP(3),
    "last_attempt_result" "FeatureAnalysisResult",
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_features_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "photo_value_scores" (
    "photo_id" UUID NOT NULL,
    "photo_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "photographer_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_new_photographer" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_value_scores_pkey" PRIMARY KEY ("photo_id")
);

-- CreateIndex
CREATE INDEX "user_interactions_user_id_created_at_idx" ON "user_interactions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "photographers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_features" ADD CONSTRAINT "photo_features_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photographer_features" ADD CONSTRAINT "photographer_features_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "photographers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_features" ADD CONSTRAINT "user_features_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_value_scores" ADD CONSTRAINT "photo_value_scores_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

