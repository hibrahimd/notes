import { sealData, unsealData } from "iron-session";
import { getSessionSecret } from "./env";

/**
 * Sifre korumali paylasim linklerinde, sifre bir kez dogrulandiktan sonra
 * ziyaretciye muhurlu bir cerez birakilir. Cerez yalnizca ilgili paylasim
 * kaydi icin gecerlidir ve bir gun sonra duser.
 */

const TTL_SECONDS = 60 * 60 * 24;

export function shareCookieName(shareId: string): string {
  return `notal_share_${shareId}`;
}

export async function sealShareAccess(shareId: string): Promise<string> {
  return sealData({ shareId }, { password: getSessionSecret(), ttl: TTL_SECONDS });
}

export async function hasShareAccess(
  shareId: string,
  seal: string | undefined
): Promise<boolean> {
  if (!seal) return false;

  try {
    const data = await unsealData<{ shareId?: string }>(seal, {
      password: getSessionSecret(),
      ttl: TTL_SECONDS,
    });
    return data?.shareId === shareId;
  } catch {
    return false;
  }
}
