import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { NoteDetail } from "@/components/notes/note-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const note = await prisma.note.findFirst({
    where: { id, userId: user.id },
    include: {
      media: true,
      transcripts: true,
      jobs: { orderBy: { startedAt: "desc" } },
      shares: true,
    },
  });

  if (!note) notFound();

  return <NoteDetail note={JSON.parse(JSON.stringify(note))} />;
}
