"use client";

import { Badge } from "@/components/ui/badge";
import { Star, Archive, ExternalLink, Clock, Globe } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NoteCardProps {
  note: {
    id: string;
    type: string;
    title: string | null;
    sourceUrl: string | null;
    summary: string | null;
    category: string | null;
    tags: string[];
    status: string;
    favorite: boolean;
    archived: boolean;
    inbox: boolean;
    siteName: string | null;
    readingTime: number | null;
    createdAt: string;
  };
}

const statusMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "error" | "info" }> = {
  pending: { label: "Bekliyor", variant: "default" },
  analyzing: { label: "Analiz ediliyor", variant: "info" },
  queued: { label: "Kuyrukta", variant: "default" },
  downloading: { label: "İndiriliyor", variant: "info" },
  extracting: { label: "İçerik çıkarılıyor", variant: "info" },
  transcribing: { label: "Transkript", variant: "info" },
  translating: { label: "Çevriliyor", variant: "info" },
  summarizing: { label: "Özetleniyor", variant: "info" },
  categorizing: { label: "Kategorileniyor", variant: "info" },
  ready: { label: "Hazır", variant: "success" },
  failed: { label: "Hata", variant: "error" },
};

const typeMap: Record<string, string> = {
  link: "Link",
  article: "Makale",
  video: "Video",
  image: "Görsel",
  text: "Metin",
  mixed: "Karışık",
};

export function NoteCard({ note }: NoteCardProps) {
  const router = useRouter();
  const status = statusMap[note.status] || { label: note.status, variant: "default" as const };

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !note.favorite }),
    });
    router.refresh();
  }

  async function toggleArchive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !note.archived, inbox: false }),
    });
    router.refresh();
  }

  return (
    <Link
      href={`/dashboard/notes/${note.id}`}
      className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge>{typeMap[note.type] || note.type}</Badge>
            {note.category && <Badge variant="info">{note.category}</Badge>}
          </div>

          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate mt-2">
            {note.title || note.sourceUrl || "İsimsiz Not"}
          </h3>

          {note.summary && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
              {note.summary}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
            {note.siteName && (
              <span className="flex items-center gap-1">
                <Globe size={12} /> {note.siteName}
              </span>
            )}
            {note.readingTime && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {note.readingTime} dk
              </span>
            )}
            <span>{new Date(note.createdAt).toLocaleDateString("tr-TR")}</span>
          </div>

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {note.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={toggleFavorite}
            className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${note.favorite ? "text-amber-500" : "text-zinc-400"}`}
          >
            <Star size={16} fill={note.favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={toggleArchive}
            className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${note.archived ? "text-blue-500" : "text-zinc-400"}`}
          >
            <Archive size={16} fill={note.archived ? "currentColor" : "none"} />
          </button>
          {note.sourceUrl && (
            <a
              href={note.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}
