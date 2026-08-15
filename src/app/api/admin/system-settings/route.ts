import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { encrypt } from "@/lib/crypto";

/** Sirlar DB'ye sifreli yazilir; bos deger degeri siler. */
function encryptSecretField(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return encrypt(trimmed);
}

async function requireAdminSession() {
  const session = await getSession();
  if (!session.userId || session.role !== "admin") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: "default" },
    });
  }

  // Mask sensitive fields
  return NextResponse.json({
    settings: {
      ...settings,
      smtpPasswordEncrypted: settings.smtpPasswordEncrypted ? "••••••••" : null,
      openaiApiKey: settings.openaiApiKey ? "••••••••" : null,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const body = await req.json();

  const allowedFields = [
    "smtpHost",
    "smtpPort",
    "smtpUsername",
    "smtpFromName",
    "smtpFromEmail",
    "smtpSecure",
    "defaultLanguage",
    "supportedLanguages",
    "openaiModel",
  ];
  const secretFields = ["smtpPasswordEncrypted", "openaiApiKey"];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
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

  const settings = await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: updateData,
    create: { id: "default", ...updateData },
  });

  return NextResponse.json({ settings });
}
