-- AlterTable
ALTER TABLE "auth_refresh_tokens" ADD COLUMN     "provider" "Provider" NOT NULL DEFAULT 'BASIC';
