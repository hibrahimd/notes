"use client";

import { useEffect, useState } from "react";
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
  X,
  Sparkles,
  Languages,
  Tag,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { metaDescription } from "@/lib/utils";

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
    coverImage: string | null;
    metadataJson: unknown;
    importance: number | null;
    errorText: string | null;
    languageDetected: string | null;
    createdAt: string;
    updatedAt: string;
    jobs: NoteJob[];
    media: {
      id: string;
      mediaType: string;
      mimeType: string | null;
      duration: number | null;
      size: number | null;
    }[];
    transcripts: {
      id: string;
      language: string;
      transcriptText: string;
      translatedText: string | null;
    }[];
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
  downloading: { label: "Video indiriliyor", variant: "info" },
  extracting: { label: "İçerik çıkarılıyor", variant: "info" },
  transcribing: { label: "Konuşma çözümleniyor", variant: "info" },
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
  const [shareOpen, setShareOpen] = useState(false);
  // Form mevcut paylasimin ayarlariyla dolar; dokunulmadan kaydedilirse
  // hicbir sey degismez
  const [expiresInDays, setExpiresInDays] = useState(daysUntil(share?.expiresAt ?? null));
  const [sharePassword, setSharePassword] = useState("");
  const [maxViews, setMaxViews] = useState(share?.maxViews ? String(share.maxViews) : "");

  const status = statusMap[note.status] || { label: note.status, variant: "default" as const };
  const skippedJobs = note.jobs.filter((job) => job.status === "skipped");

  const [showTranscript, setShowTranscript] = useState(false);
  const videoMedia = note.media.find((m) => m.mediaType === "video");
  const subtitleOriginal = note.media.find((m) => m.mediaType === "subtitle_original");
  const subtitleTranslated = note.media.find((m) => m.mediaType === "subtitle_translated");
  const transcript = note.transcripts[0];
  const mediaUrl = (mediaId: string) => `/api/notes/${note.id}/media/${mediaId}`;
  const canTranscribe = Boolean(note.sourceUrl);
  const [deletingVideo, setDeletingVideo] = useState(false);

  async function deleteVideoFile(mediaId: string) {
    if (
      !confirm(
        "Video dosyası sunucudan silinsin mi? Transkript ve altyazılar kalacak, " +
          "videoyu izlemek isterseniz yeniden işlemeniz gerekir."
      )
    )
      return;
    setDeletingVideo(true);
    await fetch(`/api/notes/${note.id}/media/${mediaId}`, { method: "DELETE" });
    router.refresh();
    setDeletingVideo(false);
  }

  const [enriching, setEnriching] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const busy = [
    "pending",
    "analyzing",
    "downloading",
    "extracting",
    "transcribing",
    "summarizing",
    "translating",
    "categorizing",
  ].includes(note.status);

  // Islem surerken sayfayi tazele ki sonuc geldiginde aninda gorunsun
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(timer);
  }, [busy, router]);

  async function runEnrich(
    action: "summarize" | "translate" | "categorize" | "transcribe"
  ) {
    setEnriching(action);
    setEnrichError(null);

    const res = await fetch(`/api/notes/${note.id}/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEnrichError(data.error || "İşlem başlatılamadı");
      setEnriching(null);
      return;
    }

    router.refresh();
    // Bundan sonrasini not.status uzerinden izliyoruz
    setEnriching(null);
  }

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
      {/* Header: sadece geri ve durum rozetleri */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/dashboard"
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={status.variant}>{status.label}</Badge>
          {note.category && <Badge variant="info">{note.category}</Badge>}
          {note.type && <Badge>{note.type}</Badge>}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        {note.translatedTitle || note.title || "İsimsiz Not"}
      </h1>
      {note.translatedTitle && note.title && note.translatedTitle !== note.title && (
        <p className="text-sm text-zinc-500 mb-2">{note.title}</p>
      )}

      {/* Meta: kaynak adinin yaninda yeni sekmede acma ikonu */}
      <div className="flex items-center gap-4 text-sm text-zinc-400 mb-4 flex-wrap">
        {note.siteName && (
          <span className="flex items-center gap-1 min-w-0">
            <Globe size={14} className="shrink-0" />
            <span className="truncate">{note.siteName}</span>
            {note.sourceUrl && (
              <a
                href={note.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Kaynağı yeni sekmede aç"
                className="shrink-0 text-blue-500 hover:text-blue-600"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </span>
        )}
        {note.readingTime && (
          <span className="flex items-center gap-1">
            <Clock size={14} /> {note.readingTime} dk okuma
          </span>
        )}
        <span>{new Date(note.createdAt).toLocaleString("tr-TR")}</span>
      </div>

      {/* Aksiyonlar: sag ust kosede degil, metanin altinda */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        <button
          onClick={toggleFavorite}
          title={note.favorite ? "Favoriden çıkar" : "Favorile"}
          className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${note.favorite ? "text-amber-500" : "text-zinc-400"}`}
        >
          <Star size={20} fill={note.favorite ? "currentColor" : "none"} />
        </button>
        <button
          onClick={toggleArchive}
          title={note.archived ? "Arşivden çıkar" : "Arşivle"}
          className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${note.archived ? "text-blue-500" : "text-zinc-400"}`}
        >
          <Archive size={20} fill={note.archived ? "currentColor" : "none"} />
        </button>
        <button
          onClick={() => setShareOpen(true)}
          title="Paylaşım"
          className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${share ? "text-emerald-500" : "text-zinc-400"}`}
        >
          <Share2 size={20} />
        </button>
        <button
          onClick={handleReprocess}
          disabled={reprocessing || busy}
          title="İçeriği yeniden çıkar"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={20} className={reprocessing ? "animate-spin" : ""} />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Notu sil"
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 cursor-pointer disabled:opacity-50"
        >
          <Trash2 size={20} />
        </button>
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

      {/* AI islemleri: otomatik degil, istenildiginde tetiklenir */}
      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runEnrich("summarize")}
              loading={enriching === "summarize" || note.status === "summarizing"}
              disabled={busy}
            >
              <Sparkles size={16} /> {note.summary ? "Özeti Yenile" : "Özetle"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runEnrich("translate")}
              loading={enriching === "translate" || note.status === "translating"}
              disabled={busy}
            >
              <Languages size={16} /> {note.translatedText ? "Çeviriyi Yenile" : "Çevir"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runEnrich("categorize")}
              loading={enriching === "categorize" || note.status === "categorizing"}
              disabled={busy}
            >
              <Tag size={16} /> {note.category ? "Kategoriyi Yenile" : "Kategorile"}
            </Button>
            {canTranscribe && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => runEnrich("transcribe")}
                loading={
                  enriching === "transcribe" ||
                  ["downloading", "transcribing"].includes(note.status)
                }
                disabled={busy}
              >
                <Video size={16} /> {transcript ? "Videoyu Yeniden İşle" : "Videoyu İşle"}
              </Button>
            )}
          </div>
          {busy && (
            <span className="text-xs text-zinc-400">
              İşleniyor, sonuç hazır olunca burada görünecek...
            </span>
          )}
        </div>
        {enrichError && (
          <p className="mt-3 text-sm text-red-500">{enrichError}</p>
        )}
      </Card>

      {/* Video oynatici: altyazilar ayri parca olarak eklenir, izleyici
          Turkce ile orijinal arasinda gecis yapabilir */}
      {videoMedia && (
        <div className="mb-6">
          <video
            controls
            playsInline
            preload="metadata"
            poster={note.coverImage || undefined}
            className="w-full rounded-xl bg-black"
          >
            <source src={mediaUrl(videoMedia.id)} type={videoMedia.mimeType || "video/mp4"} />
            {subtitleTranslated && (
              <track
                kind="subtitles"
                src={mediaUrl(subtitleTranslated.id)}
                srcLang="tr"
                label="Çeviri"
                default
              />
            )}
            {subtitleOriginal && (
              <track
                kind="subtitles"
                src={mediaUrl(subtitleOriginal.id)}
                srcLang={transcript?.language || "en"}
                label={`Orijinal${transcript?.language ? ` (${transcript.language})` : ""}`}
              />
            )}
          </video>
          <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
            <span className="text-xs text-zinc-400">
              Video sunucuda saklanıyor
              {videoMedia.size
                ? ` — ${(videoMedia.size / 1024 / 1024).toFixed(1)} MB`
                : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteVideoFile(videoMedia.id)}
              loading={deletingVideo}
            >
              <Trash2 size={16} /> Videoyu Sil
            </Button>
          </div>
        </div>
      )}

      {/* Video silinmis ama altyazi duruyorsa kullanici neden oynatici
          gormedigini bilsin */}
      {!videoMedia && transcript && (
        <Card className="mb-6 border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">
            Video dosyası silinmiş. Transkript ve altyazılar duruyor; tekrar
            izlemek isterseniz &quot;Videoyu Yeniden İşle&quot; deyin.
          </p>
        </Card>
      )}

      {/* Transkript */}
      {transcript && (
        <Card className="mb-6">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-full"
          >
            Transkript{transcript.language ? ` (${transcript.language})` : ""}
            {showTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showTranscript && (
            <div className="mt-3 space-y-4">
              {transcript.translatedText && (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Çeviri</p>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                    {transcript.translatedText}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-400 mb-1">Orijinal</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {transcript.transcriptText}
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Kapak gorseli */}
      {!videoMedia && note.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={note.coverImage}
          alt=""
          className="w-full max-h-72 object-cover rounded-xl mb-6"
        />
      )}

      {/* Ozet yoksa sayfanin kendi aciklamasi gosterilir */}
      {!note.summary && metaDescription(note.metadataJson) && (
        <Card className="mb-6">
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {metaDescription(note.metadataJson)}
          </p>
        </Card>
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

      {/* Paylasim, notun kendisinin onune gecmesin diye baslikatki ikonun
          ardinda bir modalde duruyor */}
      {shareOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => setShareOpen(false)}
      >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Paylaşım
          </h2>
          <button
            onClick={() => setShareOpen(false)}
            className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

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
      </div>
      </div>
      )}

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
