import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { safeFetchText, BlockedUrlError } from "../../lib/safe-fetch";
import { looksLikeVideoUrl, probeVideo } from "../../lib/media";
import { fetchTweetMedia, originalSizeUrl, tweetId } from "../../lib/twitter";
import { safeFetchBinary } from "../../lib/safe-fetch";
import { saveFile } from "../../lib/storage";
import path from "path";
import { transcribeNote } from "./video-processor";
import {
  chat,
  chatJson,
  translateLongText,
  detectLanguage,
  type AiConfig,
} from "../../lib/ai";
import {
  resolveAi,
  type AiTask,
} from "../ai-config";
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
  const ogType = meta("og:type") || "";
  const twitterCard = meta("twitter:card") || "";

  const hasVideo = Boolean(
    meta(
      "og:video",
      "og:video:url",
      "og:video:secure_url",
      "twitter:player:stream",
      "twitter:player"
    ) ||
      ogType.startsWith("video") ||
      twitterCard === "player" ||
      doc.querySelector("video source[src], video[src]")
  );

  return {
    title: meta("og:title", "twitter:title") || doc.title?.trim() || null,
    description: meta("og:description", "twitter:description", "description"),
    image,
    siteName: meta("og:site_name", "application-name"),
    hasVideo,
  };
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

export type EnrichAction = AiTask;

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

  // Video notlarinda makale metni yok; asil icerik transkriptte duruyor.
  // Ozet ve ceviri onu kullanmali, yoksa "islenecek metin yok" deyip cikiyordu.
  const transcript = await prisma.transcript.findFirst({
    where: { noteId },
    orderBy: { createdAt: "desc" },
  });

  let text =
    transcript?.transcriptText ||
    note.originalText ||
    metadata?.description ||
    null;

  // Elde islenecek metin yok ama not bir video linki ise once transkripti
  // cikar: kullanicinin "Ozetle" demek icin ayrica "Videoyu Isle" demesi
  // gerekmesin
  if (!text && note.sourceUrl && looksLikeVideoUrl(note.sourceUrl)) {
    await transcribeNote(noteId, userId);
    const fresh = await prisma.transcript.findFirst({
      where: { noteId },
      orderBy: { createdAt: "desc" },
    });
    text = fresh?.transcriptText || null;
    if (!text) {
      // transcribeNote hatayi zaten nota yazdi
      return;
    }
  }

  // Erken cikislarda durumu geri almak sart: aksi halde not "isleniyor"
  // durumunda kalir ve arayuz sonsuza kadar bekler
  if (!text) {
    await skipJob(
      noteId,
      action,
      "Bu notta işlenecek metin yok. Link için 'Yeniden İşle', video için " +
        "'Videoyu İşle' ile önce içeriği çıkarın."
    );
    await updateStatus(noteId, "ready");
    return;
  }

  const ai = await resolveAi(userId, action);
  if (!ai) {
    await skipJob(
      noteId,
      action,
      "Bu işlem için seçilen sağlayıcının API anahtarı tanımlı değil. " +
        "Ayarlar sayfasından ekleyebilirsiniz."
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


/**
 * Notun turu. Fotograf ve video birlikteyse "mixed": tweet'lerde ikisi ayni
 * gonderide bulunabiliyor ve tek bir tur ikisini de anlatmiyor.
 */
function noteType(
  hasVideo: boolean,
  photoCount: number,
  fallback: "link" | "article"
): string {
  if (hasVideo && photoCount > 0) return "mixed";
  if (hasVideo) return "video";
  if (photoCount > 0) return "image";
  return fallback;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Tweet fotograflarini indirip nota baglar.
 *
 * Uzak adresi saklamak yerine dosyayi indiriyoruz: bu bir yakalama
 * uygulamasi, kaynak silinince notun icerigi de gitmemeli.
 *
 * @returns kaydedilen fotograf sayisi
 */
async function saveTweetPhotos(
  noteId: string,
  photoUrls: string[]
): Promise<number> {
  // Ayni not yeniden islenirse fotograflar cogalmasin
  await prisma.noteMedia.deleteMany({ where: { noteId, mediaType: "image" } });

  let saved = 0;

  for (const [index, photoUrl] of photoUrls.entries()) {
    try {
      const result = await safeFetchBinary(originalSizeUrl(photoUrl), {
        timeoutMs: 20000,
        maxBytes: 12 * 1024 * 1024,
      });

      const mimeType = (result.contentType || "image/jpeg").split(";")[0].trim();
      const extension = IMAGE_EXTENSIONS[mimeType];
      if (!extension) continue;

      const relativePath = await saveFile(
        path.join("notes", noteId),
        `photo-${index + 1}.${extension}`,
        result.body
      );

      await prisma.noteMedia.create({
        data: {
          noteId,
          mediaType: "image",
          storagePath: relativePath,
          mimeType,
          size: result.body.byteLength,
        },
      });
      saved++;
    } catch (error) {
      console.warn(
        `[Tweet] ${noteId}: fotoğraf indirilemedi (${photoUrl}):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return saved;
}

async function processLink(noteId: string, url: string, userId: string) {
  await createJob(noteId, "analyze", "running", "Link analiz ediliyor...");

  // Not daha once video olarak islendiyse tipi koru: OpenGraph etiketleri
  // videoyu bildirmese bile elimizde indirilmis video ve transkript var,
  // yeniden isleme bunu "makale"ye dusurmemeli
  const [mediaCount, transcriptCount] = await Promise.all([
    prisma.noteMedia.count({ where: { noteId, mediaType: "video" } }),
    prisma.transcript.count({ where: { noteId } }),
  ]);
  let isVideo = mediaCount > 0 || transcriptCount > 0;

  // X gibi siteler cektigimiz HTML'de video etiketlerini her zaman
  // yayinlamiyor. Bilinen video sitelerinde kesin cevabi yt-dlp veriyor:
  // video bulamazsa hata doner, o zaman gercekten video yoktur.
  if (!isVideo && looksLikeVideoUrl(url)) {
    try {
      await probeVideo(url);
      isVideo = true;
    } catch {
      // Videosuz tweet / gonderi — normal akisa devam
    }
  }

  // Tweet'lerde fotograflar ayri bir yoldan geliyor: yt-dlp yalnizca videoyu
  // goruyor, cektigimiz HTML'den de tek bir OpenGraph gorseli cikiyor. Dort
  // fotografli bir tweet bu yuzden tek kapakla kaydediliyordu.
  let tweetPhotoCount = 0;
  let tweetText: string | null = null;

  if (tweetId(url)) {
    const tweet = await fetchTweetMedia(url);

    if (tweet) {
      tweetText = tweet.text;
      if (tweet.hasVideo) isVideo = true;
      if (tweet.photoUrls.length > 0) {
        tweetPhotoCount = await saveTweetPhotos(noteId, tweet.photoUrls);
      }
    }
  }

  await completeJob(
    noteId,
    "analyze",
    tweetPhotoCount > 0
      ? `Link analiz edildi — ${tweetPhotoCount} fotoğraf kaydedildi`
      : "Link analiz edildi"
  );

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
          type: noteType(isVideo || preview.hasVideo, tweetPhotoCount, "link"),
          title: preview.title || url,
          siteName: preview.siteName || hostname,
          coverImage: preview.image,
          originalText: tweetText,
          metadataJson: { description: tweetText || preview.description },
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
        type: noteType(isVideo || preview.hasVideo, tweetPhotoCount, "article"),
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
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const steps: { task: AiTask; enabled: boolean }[] = [
    { task: "summarize", enabled: userSettings?.autoSummarize === true },
    { task: "translate", enabled: userSettings?.autoTranslate === true },
    { task: "categorize", enabled: userSettings?.autoCategorize === true },
  ];

  for (const step of steps) {
    if (!step.enabled) continue;

    const ai = await resolveAi(userId, step.task);
    if (!ai) {
      await skipJob(
        noteId,
        step.task,
        "Bu adım için seçilen sağlayıcının API anahtarı tanımlı değil. " +
          "Ayarlar sayfasından ekleyebilirsiniz."
      );
      continue;
    }

    if (step.task === "summarize") {
      await summarize(noteId, ai.config, text, user?.preferredLanguage || "tr");
    } else if (step.task === "translate") {
      await translate(
        noteId,
        ai.config,
        text,
        title,
        user?.translationLanguage || "tr"
      );
    } else {
      await categorize(noteId, ai.config, text);
    }
  }
}

async function summarize(
  noteId: string,
  config: AiConfig,
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
  config: AiConfig,
  text: string,
  title: string | null,
  targetLanguage: string
) {
  await updateStatus(noteId, "translating");
  await createJob(noteId, "translate", "running", "Çeviri yapılıyor...");

  try {
    // Icerik zaten hedef dildeyse cevirmenin anlami yok: hem para harciyor
    // hem de metni gereksiz yere yeniden yaziyor
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    let detected = note?.languageDetected || null;

    if (!detected) {
      detected = await detectLanguage(config, text);
      if (detected) {
        await prisma.note.update({
          where: { id: noteId },
          data: { languageDetected: detected },
        });
      }
    }

    if (detected && detected === targetLanguage.toLowerCase().slice(0, 2)) {
      await completeJob(
        noteId,
        "translate",
        `İçerik zaten ${targetLanguage} dilinde, çeviri atlandı`
      );
      return;
    }

    const result = await translateLongText(config, text, targetLanguage);

    const translatedTitle = title
      ? await chat(
          config,
          `Aşağıdaki başlığı ${targetLanguage} diline çevir. Sadece çeviriyi döndür:

${title}`,
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
  config: AiConfig,
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

