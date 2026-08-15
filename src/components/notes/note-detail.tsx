"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    shares: {
      id: string;
      token: string;
      createdAt: string;
      expiresAt: string | null;
      maxViews: number | null;
      currentViews: number;
      hasPassword: boolean;
    }[];
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

/** Bitis tarihini forma yazilabilir "kac gun kaldi" degerine cevirir. */
function daysUntil(date: string | null): string {
  if (!date) return "";
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return days > 0 ? String(days) : "";
}

export function NoteDetail({ note }: NoteProps) {
  const router = useRouter();
  const share = note.shares[0];
  const [showOriginal, setShowOriginal] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Form mevcut paylasimin ayarlariyla dolar; dokunulmadan kaydedilirse
  // hicbir sey degismez
  const [expiresInDays, setExpiresInDays] = useState(daysUntil(share?.expiresAt ?? null));
  const [sharePassword, setSharePassword] = useState("");
  const [maxViews, setMaxViews] = useState(share?.maxViews ? String(share.maxViews) : "");

  const status = statusMap[note.status] || { label: note.status, variant: "default" as const };
  const skippedJobs = note.jobs.filter((job) => job.status === "skipped");

  async function postShare(extra: Record<string, unknown> = {}) {
    setSharing(true);
    await fetch(`/api/notes/${note.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        password: sharePassword || null,
        maxViews: maxViews ? Number(maxViews) : null,
        ...extra,
      }),
    });
    setSharePassword("");
    router.refresh();
    setSharing(false);
  }

  const saveShare = () => postShare();
  const removeSharePassword = () => postShare({ removePassword: true });

  async function removeShare() {
    if (!confirm("Paylaşım linkini kaldırmak istediğinize emin misiniz?")) return;
    setSharing(true);
    await fetch(`/api/notes/${note.id}/share`, { method: "DELETE" });
    router.refresh();
    setSharing(false);
  }

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
    const shareUrl = `${window.location.origin}/share/${share?.token}`;
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
            className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${note.favorite ? "text-amber-500" : "text-zinc-400"}`}
          >
            <Star size={20} fill={note.favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={toggleArchive}
            className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${note.archived ? "text-blue-500" : "text-zinc-400"}`}
          >
            <Archive size={20} fill={note.archived ? "currentColor" : "none"} />
          </button>
          {note.status !== "ready" && (
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

      {/* Atlanan adimlar */}
      {skippedJobs.length > 0 && (
        <Card className="mb-6 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
          {skippedJobs.map((job) => (
            <p key={job.id} className="text-sm text-amber-700 dark:text-amber-400">
              {job.message}
            </p>
          ))}
        </Card>
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

        {share && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 truncate">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/share/${share.token}`
                  : `/share/${share.token}`}
              </code>
              <Button variant="outline" size="sm" onClick={copyShareLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-zinc-500">
              <Badge variant={share.hasPassword ? "success" : "default"}>
                {share.hasPassword ? "Şifre korumalı" : "Şifresiz"}
              </Badge>
              <Badge variant={share.expiresAt ? "info" : "default"}>
                {share.expiresAt
                  ? `Bitiş: ${new Date(share.expiresAt).toLocaleDateString("tr-TR")}`
                  : "Süresiz"}
              </Badge>
              <Badge variant={share.maxViews ? "info" : "default"}>
                {share.maxViews
                  ? `${share.currentViews}/${share.maxViews} görüntülenme`
                  : `${share.currentViews} görüntülenme`}
              </Badge>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <Input
            id="shareExpiry"
            label="Süre (gün)"
            type="number"
            min={1}
            placeholder="Süresiz"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          />
          <Input
            id="sharePassword"
            label="Şifre"
            type="password"
            placeholder={share?.hasPassword ? "Değiştirmek için girin" : "Yok"}
            value={sharePassword}
            onChange={(e) => setSharePassword(e.target.value)}
          />
          <Input
            id="shareMaxViews"
            label="Maks. görüntülenme"
            type="number"
            min={1}
            placeholder="Sınırsız"
            value={maxViews}
            onChange={(e) => setMaxViews(e.target.value)}
          />
        </div>
        <p className="text-xs text-zinc-400 mb-3">
          Süre ve görüntülenme alanları boş bırakılırsa sınır uygulanmaz. Şifre
          alanı boş bırakılırsa mevcut şifre korunur. Kaydettiğinizde link
          değişmez, yalnızca ayarları güncellenir.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={saveShare} loading={sharing}>
            <Share2 size={16} /> {share ? "Ayarları Güncelle" : "Paylaşım Linki Oluştur"}
          </Button>
          {share?.hasPassword && (
            <Button
              variant="ghost"
              size="sm"
              onClick={removeSharePassword}
              loading={sharing}
            >
              Şifreyi Kaldır
            </Button>
          )}
          {share && (
            <Button variant="danger" size="sm" onClick={removeShare} loading={sharing}>
              <Trash2 size={16} /> Paylaşımı Kaldır
            </Button>
          )}
        </div>
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
                        job.status === "completed"
                          ? "success"
                          : job.status === "failed"
                            ? "error"
                            : job.status === "skipped"
                              ? "warning"
                              : "info"
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
