import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoteCard } from "@/components/notes/note-card";
import { NotesHeader } from "@/components/notes/notes-header";

export default async function FavoritesPage() {
  const user = await requireAuth();

  const notes = await prisma.note.findMany({
      // Gorsel notlarinda uzak bir kapak yok; ilk fotograf onizleme oluyor
      include: {
        media: {
          where: { mediaType: "image" },
          take: 1,
          select: { id: true },
        },
      },
    where: { userId: user.id, favorite: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <NotesHeader title="Favoriler" showAdd={false} />
      {notes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-lg">Favori not yok</p>
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
