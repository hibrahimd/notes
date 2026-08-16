"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, Globe } from "lucide-react";
import Link from "next/link";
import { metaDescription } from "@/lib/utils";

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
    coverImage: string | null;
    metadataJson: unknown;
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
  const [coverFailed, setCoverFailed] = useState(false);
  const status = statusMap[note.status] || { label: note.status, variant: "default" as const };
  const preview = note.summary || metaDescription(note.metadataJson);
  const showCover = Boolean(note.coverImage) && !coverFailed;

  return (
    <Link
      href={`/dashboard/notes/${note.id}`}
      className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        {showCover && (
          <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            {/* next/image kullanilmadi: onizleme gorselleri rastgele alan
                adlarindan geliyor, hepsini yapilandirmak mumkun degil */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={note.coverImage!}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setCoverFailed(true)}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge>{typeMap[note.type] || note.type}</Badge>
            {note.category && <Badge variant="info">{note.category}</Badge>}
          </div>

          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate mt-2">
            {note.title || note.sourceUrl || "İsimsiz Not"}
          </h3>

          {preview && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
              {preview}
            </p>
          )}

          {/* flex-wrap sart: site adi OpenGraph'tan geldiginde uzun olabiliyor
              ("X (formerly Twitter)") ve satir sarmadan tasip tum sayfayi
              yatay kaydiriyordu */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 text-xs text-zinc-400">
            {note.siteName && (
              <span className="flex items-center gap-1 min-w-0">
                <Globe size={12} className="shrink-0" />
                <span className="truncate">{note.siteName}</span>
                {note.sourceUrl && (
                  // Kartin kendisi nota gidiyor; kaynagi acmak isteyen bu
                  // ikona basar, tiklama karta yayilmasin diye durduruluyor
                  <a
                    href={note.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Kaynağı yeni sekmede aç"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </span>
            )}
            {note.readingTime && (
              <span className="flex items-center gap-1 shrink-0">
                <Clock size={12} /> {note.readingTime} dk
              </span>
            )}
            <span className="shrink-0">
              {new Date(note.createdAt).toLocaleDateString("tr-TR")}
            </span>
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

      </div>
    </Link>
  );
}
