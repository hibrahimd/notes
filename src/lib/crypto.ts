import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { getEncryptionSecret } from "./env";

/**
 * Kullanici API anahtarlari ve SMTP sifresi gibi geri okunmasi gereken sirlar
 * icin AES-256-GCM ile iki yonlu sifreleme.
 *
 * Depolanan format: enc.v1.<iv_b64>.<tag_b64>.<ciphertext_b64>
 * Bu on eki tasimayan degerler sifreleme oncesinden kalma duz metin kabul edilir
 * ve oldugu gibi dondurulur; boylece mevcut kayitlar bozulmaz. Kayit her
 * guncellendiginde sifreli forma gecer.
 */

const PREFIX = "enc.v1.";
const KEY_SALT = "notal-encryption-v1";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (!cachedKey) {
    cachedKey = scryptSync(getEncryptionSecret(), KEY_SALT, 32);
  }
  return cachedKey;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX.slice(0, -1),
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decrypt(stored: string): string {
  // Sifreleme oncesi kaydedilmis duz metin degerler
  if (!isEncrypted(stored)) return stored;

  const parts = stored.split(".");
  if (parts.length !== 5) {
    throw new Error("Sifreli deger bozuk: beklenmeyen format");
  }

  const [, , ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Cozulemeyen kayitlarda patlamak yerine null donen guvenli surum. */
export function tryDecrypt(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decrypt(stored);
  } catch (error) {
    console.error("[crypto] Sifreli deger cozulemedi:", error);
    return null;
  }
}
