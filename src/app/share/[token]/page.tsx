import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Clock, ExternalLink } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedNotePage({ params }: PageProps) {
  const { token } = await params;

  const share = await prisma.share.findUnique({
    where: { token },
    include: {
      note: true,
    },
  });

  if (!share) notFound();

  // Check expiration
  if (share.expiresAt && share.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <Card className="max-w-md text-center">
          <p className="text-zinc-500">Bu paylaşım linkinin süresi dolmuş.</p>
        </Card>
      </div>
    );
  }

  // Check max views
  if (share.maxViews && share.currentViews >= share.maxViews) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <Card className="max-w-md text-center">
          <p className="text-zinc-500">Bu paylaşım linki maksimum görüntülenme sayısına ulaştı.</p>
        </Card>
      </div>
    );
  }

  // Increment view count
  await prisma.share.update({
    where: { id: share.id },
    data: { currentViews: { increment: 1 } },
  });

  const note = share.note;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
            <span className="text-white dark:text-zinc-900 font-bold text-sm">N</span>
          </div>
          <span className="text-sm text-zinc-400">Not Al ile paylaşıldı</span>
        </div>

        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
          {note.translatedTitle || note.title || "İsimsiz Not"}
        </h1>

        <div className="flex items-center gap-4 text-sm text-zinc-400 mb-6 flex-wrap">
          {note.category && <Badge variant="info">{note.category}</Badge>}
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

        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {note.tags.map((tag) => (
              <span key={tag} className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {note.summary && (
          <Card className="mb-6">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Özet</h2>
            <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">{note.summary}</p>
          </Card>
        )}

        {note.translatedText && (
          <Card className="mb-6">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Çeviri</h2>
            <div className="text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {note.translatedText}
            </div>
          </Card>
        )}

        {note.originalText && (
          <Card className="mb-6">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Orijinal Metin</h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
              {note.originalText}
            </div>
          </Card>
        )}

        <div className="text-center mt-12 text-sm text-zinc-400">
          <p>Not Al — İçerik toplama ve anlamlandırma platformu</p>
        </div>
      </div>
    </div>
  );
}
