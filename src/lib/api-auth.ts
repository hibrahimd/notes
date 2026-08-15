import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { candidatePrefixes, verifyToken } from "./tokens";
import type { UserModel } from "@/generated/prisma/models";

/**
 * Bearer token ile kimlik dogrulama (API anahtarlari ve iPhone kisayol tokeni).
 *
 * Onceden her istek tum anahtarlari cekip her biri icin bcrypt calistiriyordu;
 * bu, kullanici sayisiyla dogru orantili CPU maliyeti demekti. Artik tokenin
 * gizli olmayan prefix'i indeksli kolondan aranip yalnizca eslesen satir(lar)
 * icin karsilastirma yapiliyor.
 */

/** Prefix kolonu bos olan, sifreleme oncesi uretilmis kisayol tokenlari icin tavan. */
const LEGACY_SCAN_LIMIT = 100;

export async function authenticateToken(token: string): Promise<UserModel | null> {
  if (!token) return null;

  const prefixes = candidatePrefixes(token);
  if (prefixes.length === 0) return null;

  // 1) API anahtarlari
  const apiKeys = await prisma.apiKey.findMany({
    where: { keyPrefix: { in: prefixes }, revokedAt: null },
    include: { user: true },
  });

  for (const key of apiKeys) {
    if (await verifyToken(token, key.keyHash)) {
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
      return key.user;
    }
  }

  // 2) Kisayol tokenlari
  const settings = await prisma.userSettings.findMany({
    where: { shortcutTokenPrefix: { in: prefixes } },
    include: { user: true },
  });

  for (const s of settings) {
    if (s.shortcutTokenHash && (await verifyToken(token, s.shortcutTokenHash))) {
      return s.user;
    }
  }

  // 3) Prefix'i kaydedilmemis eski kisayol tokenlari. Bu kume yeni token
  //    uretildikce bosalir; tavani asarsa uyarilir.
  const legacy = await prisma.userSettings.findMany({
    where: { shortcutTokenPrefix: null, shortcutTokenHash: { not: null } },
    include: { user: true },
    take: LEGACY_SCAN_LIMIT,
  });

  if (legacy.length === LEGACY_SCAN_LIMIT) {
    console.warn(
      `[api-auth] ${LEGACY_SCAN_LIMIT} eski kisayol tokeni tarandi; ` +
        "kullanicilarin token'larini yenilemesi gerekiyor."
    );
  }

  for (const s of legacy) {
    if (s.shortcutTokenHash && (await verifyToken(token, s.shortcutTokenHash))) {
      return s.user;
    }
  }

  return null;
}

/** Authorization basligindan Bearer token'i cikarir. */
export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function authenticateRequest(
  req: NextRequest
): Promise<UserModel | null> {
  const token = bearerToken(req);
  if (!token) return null;
  return authenticateToken(token);
}
