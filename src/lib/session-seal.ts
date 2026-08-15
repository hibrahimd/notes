import { unsealData } from "iron-session";
import { getSessionSecret } from "./env";

/**
 * Oturum cerezini `next/headers` bagimliligi olmadan cozen yardimcilar.
 * proxy.ts bu dosyayi kullanir; orada `cookies()` degil istegin kendi
 * cerezleri okunur.
 */

export interface SessionData {
  userId?: string;
  role?: string;
  email?: string;
}

export const SESSION_COOKIE_NAME = "notal_session";

/** Cerezin muhrunu veritabanina gitmeden dogrular. Gecersizse null doner. */
export async function readSessionSeal(
  seal: string | undefined
): Promise<SessionData | null> {
  if (!seal) return null;

  try {
    const data = await unsealData<SessionData>(seal, {
      password: getSessionSecret(),
    });
    return data?.userId ? data : null;
  } catch {
    return null;
  }
}
