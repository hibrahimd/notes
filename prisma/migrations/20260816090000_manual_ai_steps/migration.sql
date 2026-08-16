-- AlterTable
ALTER TABLE "user_settings" ALTER COLUMN "auto_summarize" SET DEFAULT false,
ALTER COLUMN "auto_translate" SET DEFAULT false,
ALTER COLUMN "auto_transcribe" SET DEFAULT false,
ALTER COLUMN "auto_categorize" SET DEFAULT false;


-- Mevcut kullanicilar da manuel tetiklemeye gecsin
UPDATE "user_settings"
SET "auto_summarize" = false,
    "auto_translate" = false,
    "auto_transcribe" = false,
    "auto_categorize" = false;
