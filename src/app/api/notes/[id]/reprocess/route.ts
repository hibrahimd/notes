import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { noteQueue } from "@/lib/queue";

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

  await prisma.note.update({
    where: { id },
    data: { status: "pending", errorText: null },
  });

  await noteQueue.add(
    "process-note",
    { noteId: note.id, userId: session.userId },
    { jobId: `note-${note.id}-${Date.now()}` }
  );

  return NextResponse.json({ message: "Not yeniden işleme alındı" });
}
