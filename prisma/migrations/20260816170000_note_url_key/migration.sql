-- Ayni icerigin farkli adreslerle ikinci kez kaydedilmesini engellemek icin
-- karsilastirma anahtari. Benzersiz kisit konmadi: mevcut kayitlarda zaten
-- tekrarlar var ve kullanici bilerek ikinci kez kaydetmek isteyebilir.
ALTER TABLE "notes" ADD COLUMN "source_url_key" TEXT;
CREATE INDEX "notes_user_id_source_url_key_idx" ON "notes"("user_id", "source_url_key");
