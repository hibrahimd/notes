import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { v4 as uuidv4 } from "uuid";

export async function POST(
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

  const token = uuidv4();

  const share = await prisma.share.create({
    data: {
      noteId: id,
      createdByUserId: session.userId,
      token,
    },
  });

  return NextResponse.json({ share, url: `/share/${token}` }, { status: 201 });
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

  await prisma.share.deleteMany({
    where: {
      noteId: id,
      createdByUserId: session.userId,
    },
  });

  return NextResponse.json({ message: "Paylaşım kaldırıldı" });
}
