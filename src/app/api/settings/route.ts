import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  let settings = await prisma.userSettings.findUnique({
    where: { userId: session.userId },
  });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId: session.userId },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { preferredLanguage: true, translationLanguage: true },
  });

  return NextResponse.json({
    settings: {
      ...settings,
      deeplApiKeyEncrypted: settings.deeplApiKeyEncrypted ? "••••••••" : null,
      openaiApiKeyEncrypted: settings.openaiApiKeyEncrypted ? "••••••••" : null,
      shortcutTokenHash: settings.shortcutTokenHash ? true : false,
      preferredLanguage: user?.preferredLanguage,
      translationLanguage: user?.translationLanguage,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = await req.json();

  // Update user language preferences
  if (body.preferredLanguage || body.translationLanguage) {
    const userData: Record<string, string> = {};
    if (body.preferredLanguage) userData.preferredLanguage = body.preferredLanguage;
    if (body.translationLanguage) userData.translationLanguage = body.translationLanguage;
    await prisma.user.update({
      where: { id: session.userId },
      data: userData,
    });
  }

  // Update user settings
  const settingsFields = [
    "deeplApiKeyEncrypted",
    "openaiApiKeyEncrypted",
    "autoSummarize",
    "autoTranslate",
    "autoTranscribe",
    "autoCategorize",
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of settingsFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.userSettings.upsert({
      where: { userId: session.userId },
      update: updateData,
      create: { userId: session.userId, ...updateData },
    });
  }

  return NextResponse.json({ message: "Ayarlar güncellendi" });
}
