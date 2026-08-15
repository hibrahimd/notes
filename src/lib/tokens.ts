import { randomBytes } from "crypto";
import bcryptjs from "bcryptjs";

/**
 * Token formati: notal_<prefix>_<secret>
 *
 * Prefix veritabaninda indeksli bir kolonda duz metin tutulur, sadece dogru
 * satiri bulmaya yarar. Gizli kisim bcrypt ile hashlenir. Boylece dogrulama
 * tum tokenlari tarayip tek tek bcrypt calistirmak yerine tek satir okuyup
 * tek karsilastirma yapar.
 *
 * Eski format (notal_<32hex>, prefix segmenti yok) icin de calisir: o
 * tokenlarda kaydedilen prefix zaten tokenin ilk 12 karakteridir, ayni indeksli
 * kolondan bulunabilir.
 */

const PREFIX_BYTES = 6; // 12 hex karakter
const SECRET_BYTES = 24; // 48 hex karakter

export interface GeneratedToken {
  /** Kullaniciya bir kez gosterilen tam token */
  token: string;
  /** Indekste aranan, gizli olmayan kisim */
  prefix: string;
  /** DB'ye yazilan bcrypt hash */
  hash: string;
}

export async function generateToken(): Promise<GeneratedToken> {
  const prefixSegment = randomBytes(PREFIX_BYTES).toString("hex");
  const secretSegment = randomBytes(SECRET_BYTES).toString("hex");

  const prefix = `notal_${prefixSegment}`;
  const token = `${prefix}_${secretSegment}`;

  return { token, prefix, hash: await bcryptjs.hash(token, 10) };
}

/**
 * Bir tokenin hangi prefix degerleriyle aranmasi gerektigini dondurur.
 * Yeni format icin prefix segmenti, eski format icin ilk 12 karakter.
 */
export function candidatePrefixes(token: string): string[] {
  const candidates = new Set<string>();

  const parts = token.split("_");
  if (parts.length >= 3 && parts[0] === "notal" && parts[1]) {
    candidates.add(`notal_${parts[1]}`);
  }

  // Eski format: keyPrefix, ham tokenin ilk 12 karakteri olarak kaydedilmisti
  if (token.length >= 12) {
    candidates.add(token.slice(0, 12));
  }

  return [...candidates];
}

export function looksLikeToken(token: string): boolean {
  return /^notal_[0-9a-f]{6,}(_[0-9a-f]{16,})?$/.test(token);
}

export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(token, hash);
}
