-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "ai_model" TEXT,
ADD COLUMN     "ai_provider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN     "anthropic_api_key_encrypted" TEXT;

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "anthropic_api_key" TEXT;

