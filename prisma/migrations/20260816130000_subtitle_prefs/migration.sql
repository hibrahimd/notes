-- Altyazi gorunum tercihleri hesaba bagli tutulur, tarayiciya degil
ALTER TABLE "user_settings" ADD COLUMN "subtitle_position" TEXT NOT NULL DEFAULT 'bottom';
ALTER TABLE "user_settings" ADD COLUMN "subtitle_size" TEXT NOT NULL DEFAULT 'normal';
