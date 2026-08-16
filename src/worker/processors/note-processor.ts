import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { tryDecrypt } from "../../lib/crypto";
import { safeFetchText, BlockedUrlError } from "../../lib/safe-fetch";
import {
  chat,
  chatJson,
  translateLongText,
  type OpenAIConfig,
} from "../../lib/openai";
import {
  prisma,
  updateStatus,
  createJob,
  skipJob,
  completeJob,
  failJob,
} from "../db";

const USER_AGENT =
  "Mozilla/5.0 (compatible; NotAl/1.0; +https://notes.kronomondo.org)";

const CATEGORIES =
  "İş, Kişisel, Haber, Teknoloji, Yazılım, Pazarlama, Eğitim, Video, Sosyal Medya, İlham, Araştırma, Satın Alma, Diğer";

interface CategoryResult {
  category?: string;
  tags?: string[];
  importance?: number;
}

interface PagePreview {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  /** Sayfada gercekten oynatilabilir bir video var mi */
  hasVideo: boolean;
}

/**
 * OpenGraph / Twitter Card etiketlerinden onizleme bilgisi cikarir.
 * Readability'nin icerik cikaramadigi sayfalarda (X, Instagram gibi JS ile
 * cizilen siteler) elde kalan tek anlamli veri genelde bu etiketlerdir.
 */
function extractPreview(doc: Document, pageUrl: string): PagePreview {
  const meta = (...names: string[]): string | null => {
    for (const name of names) {
      const el = doc.querySelector(
        `meta[property="${name}"], meta[name="${name}"]`
      );
      const content = el?.getAttribute("content")?.trim();
      if (content) return content;
    }
    return null;
  };

  const rawImage = meta("og:image", "og:image:url", "twitter:image", "twitter:image:src");
  let image: string | null = null;
  if (rawImage) {
    try {
      // Goreli adresleri sayfanin kendi adresine gore cozer
      image = new URL(rawImage, pageUrl).toString();
    } catch {
      image = null;
    }
  }

  // Alan adina bakip "x.com ise videodur" demek yanlis sonuc veriyordu:
  // videosuz tweetler de video olarak isaretleniyordu. Sayfanin kendi
  // bildirdigi video etiketlerine bakiliyor.
  const hasVideo = Boolean(
    meta(
      "og:video",
      "og:video:url",
      "og:video:secure_url",
      "twitter:player:stream"
    ) || doc.querySelector("video source[src], video[src]")
  );

  return {
    title: meta("og:title", "twitter:title") || doc.title?.trim() || null,
    description: meta("og:description", "twitter:description", "description"),
    image,
    siteName: meta("og:site_name", "application-name"),
    hasVideo,
  };
}

interface AiContext {
  config: OpenAIConfig;
  /** Anahtarin nereden geldigi; kullaniciya gosterilir */
  source: "user" | "system";
}

/**
 * OpenAI anahtarini once kullanici ayarlarindan, yoksa sistem ayarlarindan alir.
 * Hicbiri yoksa null doner ve cagiran taraf durumu nota gorunur sekilde yazar.
 */
export async function resolveAi(userId: string): Promise<AiContext | null> {
  const [systemSettings, userSettings] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { id: "default" } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  const model = systemSettings?.openaiModel || "gpt-4o-mini";

  const userKey = tryDecrypt(userSettings?.openaiApiKeyEncrypted);
  if (userKey) {
    return { config: { apiKey: userKey, model }, source: "user" };
  }

  const systemKey = tryDecrypt(systemSettings?.openaiApiKey);
  if (systemKey) {
    return { config: { apiKey: systemKey, model }, source: "system" };
  }

  return null;
}

export async function processNote(noteId: string, userId: string) {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
  });

  if (!note) {
    console.error(`[Processor] Note ${noteId} not found`);
    return;
  }

  try {
    await updateStatus(noteId, "analyzing");

    if (note.sourceUrl) {
      await processLink(noteId, note.sourceUrl, userId);
    } else if (note.originalText) {
      await processText(noteId, note.originalText, userId);
    }

    await updateStatus(noteId, "ready");
  } catch (error) {
    console.error(`[Processor] Error processing note ${noteId}:`, error);
    await prisma.note.update({
      where: { id: noteId },
      data: {
        status: "failed",
        errorText: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
    });
  }
}

export type EnrichAction = "summarize" | "translate" | "categorize";

/**
 * Tek bir AI adimini talep uzerine calistirir. Otomatik islem kapali oldugu
 * icin kullanici not detayindan ozet/ceviri/kategori istedikce buraya dusuyor.
 */
export async function enrichNote(
  noteId: string,
  userId: string,
  action: EnrichAction
) {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
  if (!note) {
    console.error(`[Processor] Note ${noteId} not found`);
    return;
  }

  const metadata = note.metadataJson as { description?: string } | null;
  const text = note.originalText || metadata?.description || null;

  // Erken cikislarda durumu geri almak sart: aksi halde not "isleniyor"
  // durumunda kalir ve arayuz sonsuza kadar bekler
  if (!text) {
    await skipJob(
      noteId,
      action,
      "Bu notta işlenecek metin yok. Önce 'Yeniden İşle' ile içeriği çıkarmayı deneyin."
    );
    await updateStatus(noteId, "ready");
    return;
  }

  const ai = await resolveAi(userId);
  if (!ai) {
    await skipJob(
      noteId,
      action,
      "OpenAI API anahtarı tanımlı değil. Ayarlar sayfasından ekleyebilirsiniz."
    );
    await updateStatus(noteId, "ready");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  try {
    if (action === "summarize") {
      await summarize(noteId, ai.config, text, user?.preferredLanguage || "tr");
    } else if (action === "translate") {
      await translate(
        noteId,
        ai.config,
        text,
        note.title,
        user?.translationLanguage || "tr"
      );
    } else {
      await categorize(noteId, ai.config, text);
    }
  } finally {
    await updateStatus(noteId, "ready");
  }
}

async function processLink(noteId: string, url: string, userId: string) {
  await createJob(noteId, "analyze", "running", "Link analiz ediliyor...");

  await completeJob(noteId, "analyze", "Link analiz edildi");

  // Fetch and extract article content
  await updateStatus(noteId, "extracting");
  await createJob(noteId, "extract", "running", "İçerik çıkarılıyor...");

  try {
    const response = await safeFetchText(url, {
      headers: { "User-Agent": USER_AGENT },
      timeoutMs: 15000,
    });

    const dom = new JSDOM(response.body, { url: response.finalUrl });
    // Readability dokumani tukettigi icin onizleme once cikarilir
    const preview = extractPreview(dom.window.document, response.finalUrl);
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const hostname = safeHostname(response.finalUrl) || safeHostname(url);

    if (!article) {
      // Icerik cikarilamadi ama OpenGraph etiketleri genelde durur:
      // baslik, gorsel ve aciklama ile en azindan bir onizleme gosterilir
      await prisma.note.update({
        where: { id: noteId },
        data: {
          type: preview.hasVideo ? "video" : "link",
          title: preview.title || url,
          siteName: preview.siteName || hostname,
          coverImage: preview.image,
          metadataJson: { description: preview.description },
        },
      });
      await completeJob(
        noteId,
        "extract",
        preview.image || preview.description
          ? "Sayfa önizlemesi alındı"
          : "İçerik çıkarılamadı, link kaydedildi"
      );
      return;
    }

    const readingTime = Math.ceil(
      (article.textContent?.split(/\s+/).length || 0) / 200
    );

    await prisma.note.update({
      where: { id: noteId },
      data: {
        type: preview.hasVideo ? "video" : "article",
        title: article.title || preview.title || null,
        originalText: article.textContent || null,
        siteName: article.siteName || preview.siteName || hostname,
        coverImage: preview.image,
        readingTime,
        metadataJson: {
          description: preview.description || article.excerpt,
          excerpt: article.excerpt,
          byline: article.byline,
          length: article.length,
          dir: article.dir,
        },
      },
    });

    await completeJob(noteId, "extract", "İçerik çıkarıldı");

    if (article.textContent) {
      await runAiPipeline(noteId, userId, article.textContent, article.title ?? null);
    }
  } catch (error) {
    const message =
      error instanceof BlockedUrlError
        ? error.message
        : `İçerik çıkarma hatası: ${error instanceof Error ? error.message : error}`;

    await failJob(noteId, "extract", message);

    // Still save the link
    await prisma.note.update({
      where: { id: noteId },
      data: {
        title: url,
        siteName: safeHostname(url),
      },
    });
  }
}

async function processText(noteId: string, text: string, userId: string) {
  await createJob(noteId, "analyze", "running", "Metin analiz ediliyor...");

  const readingTime = Math.ceil(text.split(/\s+/).length / 200);

  await prisma.note.update({
    where: { id: noteId },
    data: {
      type: "text",
      readingTime,
      title: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
    },
  });

  await completeJob(noteId, "analyze", "Metin analiz edildi");

  if (text.length > 50) {
    await runAiPipeline(noteId, userId, text, null);
  }
}

/**
 * Ozet / ceviri / kategori adimlari. Anahtar yoksa adimlar sessizce atlanmak
 * yerine nota gorunur bir kayit dusulur.
 */
async function runAiPipeline(
  noteId: string,
  userId: string,
  text: string,
  title: string | null
) {
  const ai = await resolveAi(userId);

  if (!ai) {
    await skipJob(
      noteId,
      "ai",
      "OpenAI API anahtarı tanımlı olmadığı için özet, çeviri ve kategori adımları atlandı. " +
        "Ayarlar sayfasından kendi anahtarınızı ekleyebilirsiniz."
    );
    return;
  }

  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (userSettings?.autoSummarize !== false) {
    await summarize(noteId, ai.config, text, user?.preferredLanguage || "tr");
  }

  if (userSettings?.autoTranslate !== false) {
    await translate(
      noteId,
      ai.config,
      text,
      title,
      user?.translationLanguage || "tr"
    );
  }

  if (userSettings?.autoCategorize !== false) {
    await categorize(noteId, ai.config, text);
  }
}

async function summarize(
  noteId: string,
  config: OpenAIConfig,
  text: string,
  language: string
) {
  await updateStatus(noteId, "summarizing");
  await createJob(noteId, "summarize", "running", "Özet oluşturuluyor...");

  try {
    const summary = await chat(
      config,
      `Aşağıdaki içeriği ${language} dilinde kısa ve öz bir şekilde özetle. ` +
        `Maksimum 3-4 cümle:\n\n${text.slice(0, 8000)}`
    );
    await prisma.note.update({ where: { id: noteId }, data: { summary } });
    await completeJob(noteId, "summarize", "Özet oluşturuldu");
  } catch (error) {
    await failJob(noteId, "summarize", `Özetleme hatası: ${errorText(error)}`);
  }
}

async function translate(
  noteId: string,
  config: OpenAIConfig,
  text: string,
  title: string | null,
  targetLanguage: string
) {
  await updateStatus(noteId, "translating");
  await createJob(noteId, "translate", "running", "Çeviri yapılıyor...");

  try {
    const result = await translateLongText(config, text, targetLanguage);

    const translatedTitle = title
      ? await chat(
          config,
          `Aşağıdaki başlığı ${targetLanguage} diline çevir. Sadece çeviriyi döndür:\n\n${title}`,
          { maxTokens: 200 }
        )
      : null;

    await prisma.note.update({
      where: { id: noteId },
      data: { translatedText: result.text, translatedTitle },
    });

    await completeJob(
      noteId,
      "translate",
      result.truncated
        ? `Çeviri tamamlandı (metin çok uzun olduğu için ilk ${result.chunkCount} bölüm çevrildi)`
        : `Çeviri tamamlandı (${result.chunkCount} bölüm)`
    );
  } catch (error) {
    await failJob(noteId, "translate", `Çeviri hatası: ${errorText(error)}`);
  }
}

async function categorize(
  noteId: string,
  config: OpenAIConfig,
  text: string
) {
  await updateStatus(noteId, "categorizing");
  await createJob(noteId, "categorize", "running", "Kategori belirleniyor...");

  try {
    const parsed = await chatJson<CategoryResult>(
      config,
      `Aşağıdaki içeriği analiz et ve şu JSON formatında döndür:
{"category": "...", "tags": ["...", "..."], "importance": 1-5}

Mümkün kategoriler: ${CATEGORIES}

İçerik:
${text.slice(0, 4000)}`
    );

    await prisma.note.update({
      where: { id: noteId },
      data: {
        category: parsed?.category || "Diğer",
        tags: Array.isArray(parsed?.tags) ? parsed.tags.slice(0, 10) : [],
        importance: Number(parsed?.importance) || 0,
      },
    });

    await completeJob(
      noteId,
      "categorize",
      parsed ? "Kategori belirlendi" : "Kategori çözümlenemedi, 'Diğer' atandı"
    );
  } catch (error) {
    await failJob(noteId, "categorize", `Kategorileme hatası: ${errorText(error)}`);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

