import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoteCard } from "@/components/notes/note-card";
import { NotesHeader } from "@/components/notes/notes-header";

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function InboxPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const limit = 20;
  const search = params.search || "";

  const where: Record<string, unknown> = {
    userId: user.id,
    inbox: true,
    archived: false,
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { originalText: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { sourceUrl: { contains: search, mode: "insensitive" } },
    ];
  }

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.note.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <NotesHeader title="Inbox" />

      {notes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 dark:text-zinc-500 text-lg">Henüz not yok</p>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">
            &quot;Not Ekle&quot; butonuna tıklayarak ilk notunuzu oluşturun
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={{ ...note, createdAt: note.createdAt.toISOString() }} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`?page=${p}${search ? `&search=${search}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                p === page
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
