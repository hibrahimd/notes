import { NextRequest, NextResponse } from "next/server";
import { urlKey } from "@/lib/url";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getNoteQueue } from "@/lib/queue";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const type = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const inbox = searchParams.get("inbox");
  const favorite = searchParams.get("favorite");
  const archived = searchParams.get("archived");

  const where: Record<string, unknown> = { userId: session.userId };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { originalText: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { sourceUrl: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;
  if (type) where.type = type;
  if (status) where.status = status;
  if (inbox !== null && inbox !== undefined) where.inbox = inbox === "true";
  if (favorite === "true") where.favorite = true;
  if (archived === "true") where.archived = true;

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        jobs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.note.count({ where }),
  ]);

  return NextResponse.json({
    notes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sourceUrl, text, title, type } = body;

    if (!sourceUrl && !text) {
      return NextResponse.json(
        { error: "Link veya metin gerekli" },
        { status: 400 }
      );
    }

    const noteType = type || (sourceUrl ? "link" : "text");
    const key = sourceUrl ? urlKey(sourceUrl) : null;

    // Ayni icerik ikinci kez eklenirse mevcut not donuyor (bkz. /api/ingest)
    if (key) {
      const existing = await prisma.note.findFirst({
        where: {
          userId: session.userId,
          OR: [{ sourceUrlKey: key }, { sourceUrl }],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json({
          note: existing,
          duplicate: true,
          message: "Bu içerik zaten kayıtlı",
        });
      }
    }

    const note = await prisma.note.create({
      data: {
        userId: session.userId,
        type: noteType,
        sourceUrl: sourceUrl || null,
        sourceUrlKey: key,
        originalText: text || null,
        title: title || null,
        status: "pending",
      },
    });

    // Queue for processing (don't fail the request if queue is unavailable)
    try {
      await getNoteQueue().add(
        "process-note",
        { noteId: note.id, userId: session.userId },
        { jobId: `note-${note.id}` }
      );
    } catch (queueError) {
      console.error("Queue error (note still created):", queueError);
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Create note error:", error);
    return NextResponse.json(
      { error: "Not oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
