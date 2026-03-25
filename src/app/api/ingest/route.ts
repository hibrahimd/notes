import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { noteQueue } from "@/lib/queue";
import bcryptjs from "bcryptjs";

async function authenticateByToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  // Check API keys
  const apiKeys = await prisma.apiKey.findMany({
    where: { revokedAt: null },
    include: { user: true },
  });

  for (const ak of apiKeys) {
    const match = await bcryptjs.compare(token, ak.keyHash);
    if (match) {
      await prisma.apiKey.update({
        where: { id: ak.id },
        data: { lastUsedAt: new Date() },
      });
      return ak.user;
    }
  }

  // Check shortcut tokens
  const settings = await prisma.userSettings.findMany({
    where: { shortcutTokenHash: { not: null } },
    include: { user: true },
  });

  for (const s of settings) {
    if (s.shortcutTokenHash) {
      const match = await bcryptjs.compare(token, s.shortcutTokenHash);
      if (match) return s.user;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateByToken(req);
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const body = await req.json();
    const { url, text, title, source } = body;

    if (!url && !text) {
      return NextResponse.json(
        { error: "URL veya metin gerekli" },
        { status: 400 }
      );
    }

    const noteType = url ? "link" : "text";

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        type: noteType,
        sourceUrl: url || null,
        originalText: text || null,
        title: title || null,
        metadataJson: source ? { source } : undefined,
        status: "pending",
      },
    });

    await noteQueue.add(
      "process-note",
      { noteId: note.id, userId: user.id },
      { jobId: `note-${note.id}` }
    );

    return NextResponse.json(
      { message: "Not kaydedildi", noteId: note.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Not kaydedilirken hata oluştu" },
      { status: 500 }
    );
  }
}
