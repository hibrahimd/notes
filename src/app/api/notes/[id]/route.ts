import { NextRequest, NextResponse } from "next/server";
import { rm } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getStoragePath } from "@/lib/storage";


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;

  const note = await prisma.note.findFirst({
    where: { id, userId: session.userId },
    include: {
      media: true,
      transcripts: true,
      jobs: { orderBy: { startedAt: "desc" } },
      shares: true,
    },
  });

  if (!note) {
    return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ note });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const note = await prisma.note.findFirst({
    where: { id, userId: session.userId },
  });

  if (!note) {
    return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
  }

  const allowedFields = [
    "title",
    "category",
    "tags",
    "inbox",
    "favorite",
    "archived",
    "userNote",
  ];
  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const updated = await prisma.note.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ note: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;

  const note = await prisma.note.findFirst({
    where: { id, userId: session.userId },
  });

  if (!note) {
    return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
  }

  await prisma.note.delete({ where: { id } });

  // Video ve altyazi dosyalari veritabaniyla birlikte gitmez; klasoru de sil
  await rm(getStoragePath("notes", id), { recursive: true, force: true }).catch(
    (error) => console.error("Medya klasörü silinemedi:", error)
  );

  return NextResponse.json({ message: "Not silindi" });
}
