import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoteCard } from "@/components/notes/note-card";
import { NotesHeader } from "@/components/notes/notes-header";

/**
 * Inbox: tum notlarin tek listesi.
 *
 * Onceden ayri bir "Inbox" ve "Tum Notlar" vardi ama aralarindaki tek fark
 * arsivlenmislerin gorunup gorunmemesiydi — Arsiv zaten ayri bir menu oldugu
 * icin iki liste ayni isi yapiyordu.
 */

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
    category?: string;
  }>;
}

const PAGE_SIZE = 20;

export default async function InboxPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page || "1"));
  const search = params.search || "";
  const category = params.category || "";

  const where: Record<string, unknown> = { userId: user.id, archived: false };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { originalText: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { sourceUrl: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;

  const [notes, total, categories] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.note.count({ where }),
    prisma.note.groupBy({
      by: ["category"],
      where: { userId: user.id, archived: false, category: { not: null } },
      _count: true,
      orderBy: { category: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  /** Filtre ve sayfa baglantilarinda mevcut aramayi korur. */
  const linkTo = (next: { category?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);

    const nextCategory = next.category !== undefined ? next.category : category;
    if (nextCategory) query.set("category", nextCategory);

    if (next.page && next.page > 1) query.set("page", String(next.page));

    const qs = query.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  const chipClass = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-medium transition-colors ${
      active
        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
    }`;

  return (
    <>
      <NotesHeader title="Inbox" />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Link href={linkTo({ category: "", page: 1 })} className={chipClass(!category)}>
            Tümü
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.category}
              href={linkTo({ category: cat.category || "", page: 1 })}
              className={chipClass(category === cat.category)}
            >
              {cat.category} ({cat._count})
            </Link>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-lg">
            {search || category ? "Not bulunamadı" : "Henüz not yok"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={{ ...note, createdAt: note.createdAt.toISOString() }}
              />
            ))}
          </div>

          <p className="text-xs text-zinc-400 text-center mt-6">
            {total} not{totalPages > 1 ? ` — sayfa ${page}/${totalPages}` : ""}
          </p>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4 flex-wrap">
          {page > 1 && (
            <Link href={linkTo({ page: page - 1 })} className={chipClass(false)}>
              ‹ Önceki
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            // Cok sayfa olunca hepsini basmak yerine mevcut sayfanin cevresi
            .filter(
              (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
            )
            .map((p, index, shown) => (
              <span key={p} className="flex items-center gap-2">
                {index > 0 && shown[index - 1] !== p - 1 && (
                  <span className="text-zinc-400 text-xs">…</span>
                )}
                <Link href={linkTo({ page: p })} className={chipClass(p === page)}>
                  {p}
                </Link>
              </span>
            ))}
          {page < totalPages && (
            <Link href={linkTo({ page: page + 1 })} className={chipClass(false)}>
              Sonraki ›
            </Link>
          )}
        </div>
      )}
    </>
  );
}
