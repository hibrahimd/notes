import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNoteQueue } from "@/lib/queue";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Yetkisiz" }, { status: 401 });
    }

    const body = await req.json();
    const { url, text, title, source } = body;

    if (!url && !text) {
      return NextResponse.json(
        { success: false, error: "URL veya metin gerekli" },
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

    try {
      await getNoteQueue().add(
        "process-note",
        { noteId: note.id, userId: user.id },
        { jobId: `note-${note.id}` }
      );
    } catch (queueError) {
      console.error("Queue error (note still created):", queueError);
    }

    return NextResponse.json(
      { success: true, message: "Not kaydedildi", noteId: note.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { success: false, error: "Not kaydedilirken hata oluştu" },
      { status: 500 }
    );
  }
}
