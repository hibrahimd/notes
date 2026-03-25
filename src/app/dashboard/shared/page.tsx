import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoteCard } from "@/components/notes/note-card";
import { NotesHeader } from "@/components/notes/notes-header";

export default async function SharedNotesPage() {
  const user = await requireAuth();

  const notes = await prisma.note.findMany({
    where: {
      userId: user.id,
      shares: { some: {} },
    },
    orderBy: { createdAt: "desc" },
    include: { shares: true },
  });

  return (
    <>
      <NotesHeader title="Paylaşılan Notlar" showAdd={false} />
      {notes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-lg">Paylaşılan not yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={{ ...note, createdAt: note.createdAt.toISOString() }} />
          ))}
        </div>
      )}
    </>
  );
}
