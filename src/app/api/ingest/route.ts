import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { urlKey } from "@/lib/url";
import { getNoteQueue } from "@/lib/queue";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * Her cevapta tek bir okunabilir `message` alani doner; iPhone kisayolu bunu
 * tek bir "Bildirim Goster" islemiyle gosterebilsin diye basari/hata ayrimi
 * icin dallanma gerekmiyor.
 *
 * `?notify=1` verildiginde hata durumlarinda da HTTP 200 doner. Kisayollar
 * uygulamasi 4xx/5xx aldiginda kendi hata kutusunu acip duruyor ve cevabin
 * icindeki mesaj kullaniciya hic ulasmiyor. Varsayilan davranis degismez;
 * curl ve diger API istemcileri dogru durum kodlarini almaya devam eder.
 */
function makeReply(softErrors: boolean) {
  return function reply(
    status: number,
    message: string,
    extra: Record<string, unknown> = {}
  ) {
    const ok = status < 400;
    return NextResponse.json(
      { success: ok, message, ...extra },
      { status: !ok && softErrors ? 200 : status }
    );
  };
}

export async function POST(req: NextRequest) {
  const softErrors = new URL(req.url).searchParams.get("notify") === "1";
  const reply = makeReply(softErrors);

  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return reply(401, "❌ Geçersiz token, kısayolu yeniden kurun", {
        error: "Yetkisiz",
      });
    }

    const body = await req.json();
    const { url, text, title, source } = body;

    if (!url && !text) {
      return reply(400, "❌ Gönderilecek link veya metin yok", {
        error: "URL veya metin gerekli",
      });
    }

    const noteType = url ? "link" : "text";
    const key = url ? urlKey(url) : null;

    // Ayni icerik ikinci kez gonderilirse yeni not acilmiyor. Adres birebir
    // ayni olmayabiliyor: paylas dugmesi izleme parametresi ekliyor, bazi
    // kaynaklar "www." koyuyor. Karsilastirma normallestirilmis anahtarla.
    if (key) {
      const existing = await prisma.note.findFirst({
        where: {
          userId: user.id,
          OR: [
            { sourceUrlKey: key },
            // Anahtari henuz doldurulmamis eski kayitlar icin
            { sourceUrl: url },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (existing) {
        return reply(200, "ℹ️ Bu içerik zaten kayıtlı", {
          noteId: existing.id,
          duplicate: true,
        });
      }
    }

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        type: noteType,
        sourceUrl: url || null,
        sourceUrlKey: key,
        originalText: text || null,
        title: title || null,
        metadataJson: source ? { source } : undefined,
        status: "pending",
      },
    });

    try {
      await getNoteQueue().add(
        "process-note",
        { noteId: note.id, userId: user.id },
        { jobId: `note-${note.id}` }
      );
    } catch (queueError) {
      console.error("Queue error (note still created):", queueError);
    }

    return reply(201, "✅ Not kaydedildi", { noteId: note.id });
  } catch (error) {
    console.error("Ingest error:", error);
    return reply(500, "❌ Not kaydedilemedi, sunucu hatası", {
      error: "Not kaydedilirken hata oluştu",
    });
  }
}
