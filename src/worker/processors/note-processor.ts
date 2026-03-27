import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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

async function processLink(noteId: string, url: string, userId: string) {
  await createJob(noteId, "analyze", "running", "Link analiz ediliyor...");

  // Detect URL type
  const urlLower = url.toLowerCase();
  const isVideo =
    urlLower.includes("youtube.com") ||
    urlLower.includes("youtu.be") ||
    urlLower.includes("twitter.com/") ||
    urlLower.includes("x.com/") ||
    urlLower.includes("instagram.com");

  if (isVideo) {
    // For now, mark as video but don't process video pipeline (v2)
    await prisma.note.update({
      where: { id: noteId },
      data: { type: "video" },
    });
    await completeJob(noteId, "analyze", "Video linki tespit edildi");
  }

  // Fetch and extract article content
  await updateStatus(noteId, "extracting");
  await createJob(noteId, "extract", "running", "İçerik çıkarılıyor...");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NotAl/1.0; +https://notes.kronomondo.org)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article) {
      const readingTime = Math.ceil(
        (article.textContent?.split(/\s+/).length || 0) / 200
      );

      await prisma.note.update({
        where: { id: noteId },
        data: {
          type: isVideo ? "video" : "article",
          title: article.title || null,
          originalText: article.textContent || null,
          siteName: article.siteName || new URL(url).hostname,
          readingTime,
          metadataJson: {
            excerpt: article.excerpt,
            byline: article.byline,
            length: article.length,
            dir: article.dir,
          },
        },
      });

      await completeJob(noteId, "extract", "İçerik çıkarıldı");

      // AI processing
      const settings = await prisma.systemSettings.findUnique({
        where: { id: "default" },
      });

      const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });

      const apiKey = userSettings?.openaiApiKeyEncrypted;

      if (apiKey && article.textContent) {
        // Summarize
        if (userSettings?.autoSummarize !== false) {
          await updateStatus(noteId, "summarizing");
          await createJob(noteId, "summarize", "running", "Özet oluşturuluyor...");
          try {
            const summary = await callOpenAI(
              apiKey,
              settings?.openaiModel || "gpt-4o-mini",
              `Aşağıdaki makaleyi ${user?.preferredLanguage || "tr"} dilinde kısa ve öz bir şekilde özetle. Maksimum 3-4 cümle:\n\n${article.textContent.slice(0, 8000)}`
            );
            await prisma.note.update({
              where: { id: noteId },
              data: { summary },
            });
            await completeJob(noteId, "summarize", "Özet oluşturuldu");
          } catch (e) {
            await failJob(noteId, "summarize", `Özetleme hatası: ${e}`);
          }
        }

        // Translate
        if (userSettings?.autoTranslate !== false) {
          await updateStatus(noteId, "translating");
          await createJob(noteId, "translate", "running", "Çeviri yapılıyor...");
          try {
            const targetLang = user?.translationLanguage || "tr";
            const textToTranslate = article.textContent.slice(0, 12000);
            const translated = await callOpenAI(
              apiKey,
              settings?.openaiModel || "gpt-4o-mini",
              `Aşağıdaki metni ${targetLang} diline çevir. Sadece çeviriyi döndür, başka bir şey ekleme:\n\n${textToTranslate}`
            );
            const translatedTitle = article.title
              ? await callOpenAI(
                  apiKey,
                  settings?.openaiModel || "gpt-4o-mini",
                  `Aşağıdaki başlığı ${targetLang} diline çevir. Sadece çeviriyi döndür:\n\n${article.title}`
                )
              : null;
            await prisma.note.update({
              where: { id: noteId },
              data: { translatedText: translated, translatedTitle },
            });
            await completeJob(noteId, "translate", "Çeviri tamamlandı");
          } catch (e) {
            await failJob(noteId, "translate", `Çeviri hatası: ${e}`);
          }
        }

        // Categorize
        if (userSettings?.autoCategorize !== false) {
          await updateStatus(noteId, "categorizing");
          await createJob(noteId, "categorize", "running", "Kategori belirleniyor...");
          try {
            const catResult = await callOpenAI(
              apiKey,
              settings?.openaiModel || "gpt-4o-mini",
              `Aşağıdaki makale içeriğini analiz et ve şu JSON formatında döndür:
{"category": "...", "tags": ["...", "..."], "importance": 1-5}

Mümkün kategoriler: İş, Kişisel, Haber, Teknoloji, Yazılım, Pazarlama, Eğitim, Video, Sosyal Medya, İlham, Araştırma, Satın Alma, Diğer

Sadece JSON döndür, başka bir şey ekleme.

İçerik:
${article.textContent.slice(0, 4000)}`
            );

            try {
              const parsed = JSON.parse(catResult);
              await prisma.note.update({
                where: { id: noteId },
                data: {
                  category: parsed.category || "Diğer",
                  tags: parsed.tags || [],
                  importance: parsed.importance || 0,
                },
              });
            } catch {
              await prisma.note.update({
                where: { id: noteId },
                data: { category: "Diğer" },
              });
            }
            await completeJob(noteId, "categorize", "Kategori belirlendi");
          } catch (e) {
            await failJob(noteId, "categorize", `Kategorileme hatası: ${e}`);
          }
        }
      }
    } else {
      // No readable content
      await prisma.note.update({
        where: { id: noteId },
        data: {
          title: dom.window.document.title || url,
          siteName: new URL(url).hostname,
        },
      });
      await completeJob(noteId, "extract", "İçerik çıkarılamadı, link kaydedildi");
    }
  } catch (error) {
    await failJob(
      noteId,
      "extract",
      `İçerik çıkarma hatası: ${error instanceof Error ? error.message : error}`
    );
    // Still save the link
    await prisma.note.update({
      where: { id: noteId },
      data: {
        title: url,
        siteName: new URL(url).hostname,
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

  // AI processing
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
  });
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const apiKey = userSettings?.openaiApiKeyEncrypted;

  if (apiKey && text.length > 50) {
    if (userSettings?.autoSummarize !== false) {
      await updateStatus(noteId, "summarizing");
      try {
        const summary = await callOpenAI(
          apiKey,
          settings?.openaiModel || "gpt-4o-mini",
          `Aşağıdaki metni ${user?.preferredLanguage || "tr"} dilinde kısa özetle:\n\n${text.slice(0, 8000)}`
        );
        await prisma.note.update({ where: { id: noteId }, data: { summary } });
      } catch (e) {
        console.error("Summarize error:", e);
      }
    }

    if (userSettings?.autoTranslate !== false) {
      await updateStatus(noteId, "translating");
      try {
        const translated = await callOpenAI(
          apiKey,
          settings?.openaiModel || "gpt-4o-mini",
          `Aşağıdaki metni ${user?.translationLanguage || "tr"} diline çevir:\n\n${text.slice(0, 12000)}`
        );
        await prisma.note.update({
          where: { id: noteId },
          data: { translatedText: translated },
        });
      } catch (e) {
        console.error("Translate error:", e);
      }
    }

    if (userSettings?.autoCategorize !== false) {
      await updateStatus(noteId, "categorizing");
      try {
        const catResult = await callOpenAI(
          apiKey,
          settings?.openaiModel || "gpt-4o-mini",
          `Analiz et ve JSON döndür: {"category": "...", "tags": ["..."], "importance": 1-5}
Kategoriler: İş, Kişisel, Haber, Teknoloji, Yazılım, Pazarlama, Eğitim, Video, Sosyal Medya, İlham, Araştırma, Satın Alma, Diğer
Sadece JSON:\n\n${text.slice(0, 4000)}`
        );
        try {
          const parsed = JSON.parse(catResult);
          await prisma.note.update({
            where: { id: noteId },
            data: {
              category: parsed.category || "Diğer",
              tags: parsed.tags || [],
              importance: parsed.importance || 0,
            },
          });
        } catch {
          await prisma.note.update({
            where: { id: noteId },
            data: { category: "Diğer" },
          });
        }
      } catch (e) {
        console.error("Categorize error:", e);
      }
    }
  }
}

async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || "";
}

async function updateStatus(noteId: string, status: string) {
  await prisma.note.update({ where: { id: noteId }, data: { status } });
}

async function createJob(
  noteId: string,
  jobType: string,
  status: string,
  message: string
) {
  await prisma.noteJob.create({
    data: {
      noteId,
      jobType,
      status,
      message,
      startedAt: new Date(),
    },
  });
}

async function completeJob(noteId: string, jobType: string, message: string) {
  const job = await prisma.noteJob.findFirst({
    where: { noteId, jobType, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (job) {
    await prisma.noteJob.update({
      where: { id: job.id },
      data: { status: "completed", message, finishedAt: new Date(), progress: 100 },
    });
  }
}

async function failJob(noteId: string, jobType: string, errorText: string) {
  const job = await prisma.noteJob.findFirst({
    where: { noteId, jobType, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (job) {
    await prisma.noteJob.update({
      where: { id: job.id },
      data: { status: "failed", errorText, finishedAt: new Date() },
    });
  }
}
