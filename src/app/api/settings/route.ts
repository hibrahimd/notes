import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { encrypt } from "@/lib/crypto";

/** Kullanicinin girdigi sirlar DB'ye sifreli yazilir; bos deger anahtari siler. */
function encryptSecretField(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return encrypt(trimmed);
}

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
      anthropicApiKeyEncrypted: settings.anthropicApiKeyEncrypted ? "••••••••" : null,
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
  const booleanFields = [
    "autoSummarize",
    "autoTranslate",
    "autoTranscribe",
    "autoCategorize",
  ];
  const secretFields = [
    "deeplApiKeyEncrypted",
    "openaiApiKeyEncrypted",
    "anthropicApiKeyEncrypted",
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of booleanFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }
  for (const field of secretFields) {
    // Maskeli deger geri gonderildiyse mevcut siri ezme
    if (body[field] === "••••••••") continue;
    const encrypted = encryptSecretField(body[field]);
    if (encrypted !== undefined) {
      updateData[field] = encrypted;
    }
  }

  // Her is icin saglayici ve model
  for (const task of ["summarize", "translate", "categorize"] as const) {
    const providerField = `${task}Provider`;
    const modelField = `${task}Model`;

    if (body[providerField] === "openai" || body[providerField] === "anthropic") {
      updateData[providerField] = body[providerField];
    }
    if (typeof body[modelField] === "string") {
      // Bos birakilirsa saglayicinin varsayilani kullanilir
      updateData[modelField] = body[modelField].trim() || null;
    }
  }
  if (typeof body.transcribeModel === "string") {
    updateData.transcribeModel = body.transcribeModel.trim() || null;
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
