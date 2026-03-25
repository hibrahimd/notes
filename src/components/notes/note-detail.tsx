"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  ExternalLink,
  Star,
  Archive,
  Share2,
  RefreshCw,
  Trash2,
  Clock,
  Globe,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NoteJob {
  id: string;
  jobType: string;
  status: string;
  message: string | null;
  progress: number;
  errorText: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface NoteProps {
  note: {
    id: string;
    type: string;
    title: string | null;
    sourceUrl: string | null;
    originalText: string | null;
    summary: string | null;
    translatedTitle: string | null;
    translatedText: string | null;
    category: string | null;
    tags: string[];
    status: string;
    favorite: boolean;
    archived: boolean;
    inbox: boolean;
    siteName: string | null;
    readingTime: number | null;
    importance: number | null;
    errorText: string | null;
    languageDetected: string | null;
    createdAt: string;
    updatedAt: string;
    jobs: NoteJob[];
    shares: { id: string; token: string; createdAt: string }[];
  };
}

const statusMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "error" | "info" }> = {
  pending: { label: "Bekliyor", variant: "default" },
  analyzing: { label: "Analiz ediliyor", variant: "info" },
  extracting: { label: "İçerik çıkarılıyor", variant: "info" },
  translating: { label: "Çevriliyor", variant: "info" },
  summarizing: { label: "Özetleniyor", variant: "info" },
  categorizing: { label: "Kategorileniyor", variant: "info" },
  ready: { label: "Hazır", variant: "success" },
  failed: { label: "Hata", variant: "error" },
};

export function NoteDetail({ note }: NoteProps) {
  const router = useRouter();
  const [showOriginal, setShowOriginal] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const status = statusMap[note.status] || { label: note.status, variant: "default" as const };

  async function handleReprocess() {
    setReprocessing(true);
    await fetch(`/api/notes/${note.id}/reprocess`, { method: "POST" });
    router.refresh();
    setReprocessing(false);
  }

  async function handleDelete() {
    if (!confirm("Bu notu silmek istediğinize emin misiniz?")) return;
    setDeleting(true);
    await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  async function toggleFavorite() {
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !note.favorite }),
    });
    router.refresh();
  }

  async function toggleArchive() {
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !note.archived, inbox: false }),
    });
    router.refresh();
  }

  async function copyShareLink() {
    const shareUrl = `${window.location.origin}/share/${note.shares[0]?.token}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={status.variant}>{status.label}</Badge>
            {note.category && <Badge variant="info">{note.category}</Badge>}
            {note.type && <Badge>{note.type}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleFavorite}
            className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 ${note.favorite ? "text-amber-500" : "text-zinc-400"}`}
          >
            <Star size={20} fill={note.favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={toggleArchive}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
          >
            <Archive size={20} />
          </button>
          {note.status === "failed" && (
            <Button variant="outline" size="sm" onClick={handleReprocess} loading={reprocessing}>
              <RefreshCw size={16} /> Yeniden İşle
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        {note.translatedTitle || note.title || "İsimsiz Not"}
      </h1>
      {note.translatedTitle && note.title && note.translatedTitle !== note.title && (
        <p className="text-sm text-zinc-500 mb-2">{note.title}</p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-zinc-400 mb-6 flex-wrap">
        {note.siteName && (
          <span className="flex items-center gap-1">
            <Globe size={14} /> {note.siteName}
          </span>
        )}
        {note.readingTime && (
          <span className="flex items-center gap-1">
            <Clock size={14} /> {note.readingTime} dk okuma
          </span>
        )}
        <span>{new Date(note.createdAt).toLocaleString("tr-TR")}</span>
        {note.sourceUrl && (
          <a
            href={note.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
          >
            <ExternalLink size={14} /> Kaynağa git
          </a>
        )}
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {note.tags.map((tag) => (
            <span key={tag} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {note.errorText && (
        <Card className="mb-6 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
          <p className="text-sm text-red-600 dark:text-red-400">{note.errorText}</p>
        </Card>
      )}

      {/* Summary */}
      {note.summary && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            Özet
          </h2>
          <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">{note.summary}</p>
        </Card>
      )}

      {/* Translated Text */}
      {note.translatedText && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            Çeviri
          </h2>
          <div className="text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {note.translatedText}
          </div>
        </Card>
      )}

      {/* Original Text Toggle */}
      {note.originalText && (
        <Card className="mb-6">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-full"
          >
            Orijinal Metin
            {showOriginal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showOriginal && (
            <div className="mt-3 text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto text-sm">
              {note.originalText}
            </div>
          )}
        </Card>
      )}

      {/* Share */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          Paylaşım
        </h2>
        {note.shares.length > 0 ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 truncate">
              {typeof window !== "undefined" ? `${window.location.origin}/share/${note.shares[0].token}` : `/share/${note.shares[0].token}`}
            </code>
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={async () => {
            await fetch(`/api/notes/${note.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ visibility: "public" }),
            });
            // TODO: create share link via API
            router.refresh();
          }}>
            <Share2 size={16} /> Paylaşım Linki Oluştur
          </Button>
        )}
      </Card>

      {/* Jobs / Processing Status */}
      {note.jobs.length > 0 && (
        <Card className="mb-6">
          <button
            onClick={() => setShowJobs(!showJobs)}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-full"
          >
            İşlem Durumu ({note.jobs.length})
            {showJobs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showJobs && (
            <div className="mt-3 space-y-2">
              {note.jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        job.status === "completed" ? "success" : job.status === "failed" ? "error" : "info"
                      }
                    >
                      {job.status}
                    </Badge>
                    <span className="text-zinc-600 dark:text-zinc-400">{job.jobType}</span>
                  </div>
                  <span className="text-zinc-400 text-xs">
                    {job.message || job.errorText || ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
