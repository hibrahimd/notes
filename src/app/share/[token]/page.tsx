import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Clock, ExternalLink, Lock } from "lucide-react";
import { hasShareAccess, shareCookieName } from "@/lib/share-access";
import { unlockShare } from "./actions";

// Goruntulenme sayaci ve son kullanma kontrolu her istekte taze calismali
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ hata?: string }>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="max-w-md text-center">{children}</Card>
    </div>
  );
}

export default async function SharedNotePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { hata } = await searchParams;

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
      <Notice>
        <p className="text-zinc-500">Bu paylaşım linkinin süresi dolmuş.</p>
      </Notice>
    );
  }

  // Check max views
  if (share.maxViews && share.currentViews >= share.maxViews) {
    return (
      <Notice>
        <p className="text-zinc-500">
          Bu paylaşım linki maksimum görüntülenme sayısına ulaştı.
        </p>
      </Notice>
    );
  }

  // Password gate
  if (share.passwordHash) {
    const cookieStore = await cookies();
    const unlocked = await hasShareAccess(
      share.id,
      cookieStore.get(shareCookieName(share.id))?.value
    );

    if (!unlocked) {
      return (
        <Notice>
          <Lock size={28} className="mx-auto text-zinc-400 mb-3" />
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Bu not şifre korumalı
          </h1>
          <p className="text-sm text-zinc-500 mb-5">
            Görüntülemek için paylaşan kişiden aldığınız şifreyi girin.
          </p>
          <form action={unlockShare} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <input
              type="password"
              name="password"
              required
              autoFocus
              placeholder="Şifre"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {hata && (
              <p className="text-sm text-red-500">Şifre hatalı, tekrar deneyin.</p>
            )}
            <Button type="submit" className="w-full">
              Görüntüle
            </Button>
          </form>
        </Notice>
      );
    }
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
