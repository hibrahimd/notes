-- AlterTable
ALTER TABLE "user_settings" DROP COLUMN "ai_model",
DROP COLUMN "ai_provider",
ADD COLUMN     "categorize_model" TEXT,
ADD COLUMN     "categorize_provider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN     "summarize_model" TEXT,
ADD COLUMN     "summarize_provider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN     "transcribe_model" TEXT,
ADD COLUMN     "translate_model" TEXT,
ADD COLUMN     "translate_provider" TEXT NOT NULL DEFAULT 'openai';

