-- AlterTable
ALTER TABLE "login_codes" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "shortcut_token_prefix" TEXT;

-- CreateIndex
CREATE INDEX "login_codes_user_id_created_at_idx" ON "login_codes"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "login_codes_ip_address_created_at_idx" ON "login_codes"("ip_address", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_settings_shortcut_token_prefix_idx" ON "user_settings"("shortcut_token_prefix");

-- CreateIndex
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

