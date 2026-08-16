import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { NoteDetail } from "@/components/notes/note-detail";
import {
  DEFAULT_SUBTITLE_PREFS,
  type SubtitlePrefs,
} from "@/components/notes/subtitles";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  // Altyazi gorunumu hesaba bagli; oynatici baslangic degerini buradan alir
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { subtitlePosition: true, subtitleSize: true },
  });

  const note = await prisma.note.findFirst({
    where: { id, userId: user.id },
    include: {
      media: true,
      transcripts: true,
      jobs: { orderBy: { startedAt: "desc" } },
      shares: {
        select: {
          id: true,
          token: true,
          createdAt: true,
          expiresAt: true,
          maxViews: true,
          currentViews: true,
          passwordHash: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!note) notFound();

  // Paylasim sifresinin hash'i istemciye gonderilmez, yalnizca var/yok bilgisi
  const safeNote = {
    ...note,
    shares: note.shares.map(({ passwordHash, ...share }) => ({
      ...share,
      hasPassword: Boolean(passwordHash),
    })),
  };

  return (
    <NoteDetail
      note={JSON.parse(JSON.stringify(safeNote))}
      subtitlePrefs={{
        position: (settings?.subtitlePosition ||
          DEFAULT_SUBTITLE_PREFS.position) as SubtitlePrefs["position"],
        size: (settings?.subtitleSize ||
          DEFAULT_SUBTITLE_PREFS.size) as SubtitlePrefs["size"],
      }}
    />
  );
}
