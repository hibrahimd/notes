import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateToken } from "@/lib/tokens";
import { encrypt, tryDecrypt } from "@/lib/crypto";

/**
 * Kurulum akisinda token'in tekrar okunabilmesi gerekiyor: kullanici token'i
 * masaustunde uretip kisayolu telefonunda kuruyor. Onceden ham token yalnizca
 * tarayicinin localStorage'inda tutuluyordu, bu yuzden baska bir cihazda
 * kurulum butonlari islevsiz kaliyordu.
 */
export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.userId },
  });

  if (!settings?.shortcutTokenHash) {
    return NextResponse.json({ token: null, hasToken: false });
  }

  const token = tryDecrypt(settings.shortcutTokenEncrypted);

  return NextResponse.json({
    token,
    hasToken: true,
    // Sifreleme oncesi uretilmis tokenlar geri okunamaz, yenilenmesi gerekir
    needsRegenerate: token === null,
  });
}

export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { token, prefix, hash } = await generateToken();
  const encrypted = encrypt(token);

  await prisma.userSettings.upsert({
    where: { userId: session.userId },
    update: {
      shortcutTokenHash: hash,
      shortcutTokenPrefix: prefix,
      shortcutTokenEncrypted: encrypted,
    },
    create: {
      userId: session.userId,
      shortcutTokenHash: hash,
      shortcutTokenPrefix: prefix,
      shortcutTokenEncrypted: encrypted,
    },
  });

  return NextResponse.json({ token });
}

export async function DELETE() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  await prisma.userSettings.update({
    where: { userId: session.userId },
    data: {
      shortcutTokenHash: null,
      shortcutTokenPrefix: null,
      shortcutTokenEncrypted: null,
    },
  });

  return NextResponse.json({ message: "Shortcut token'ı silindi" });
}
