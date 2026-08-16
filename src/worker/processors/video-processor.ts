import { rm, writeFile } from "fs/promises";
import path from "path";
import { getStoragePath, ensureDir } from "../../lib/storage";
import {
  probeVideo,
  pickCaptionLanguage,
  fetchCaptions,
  downloadVideo,
  extractAudio,
  buildVtt,
  MediaError,
  type Segment,
} from "../../lib/media";
import { transcribeAudio, translateSegments } from "../../lib/transcribe";
import {
  prisma,
  updateStatus,
  createJob,
  skipJob,
  progressJob,
  completeJob,
  failJob,
} from "../db";
import { resolveAi, resolveTranscription } from "../ai-config";
import { youtubeVideoId } from "../../lib/utils";

/**
 * Video isleme hatti.
 *
 * Metin iki kaynaktan gelebiliyor:
 *   1. Sitenin kendi altyazisi — once bu denenir. Saniyeler surer, bedavadir
 *      ve hicbir API anahtari gerektirmez. YouTube ve X'te var.
 *   2. Konusma tanima — altyazi yoksa videonun sesi Whisper'a gonderilir.
 *
 * Video dosyasi bundan ayri bir karar: izlemek icin gerekiyor. YouTube'da
 * indirilmiyor cunku medya akisi sunucu IP'lerine 403 donuyor ve oynatici
 * zaten not detayina gomulu geliyor. Diger kaynaklarda izlemenin baska yolu
 * olmadigi icin indiriliyor — altyazi bulunmus olsa bile.
 *
 * Talep uzerine calisir; otomatik degil.
 */

/** Notun medya dosyalarinin durdugu klasor. */
export function noteMediaDir(noteId: string): string {
  return getStoragePath("notes", noteId);
}

export async function transcribeNote(noteId: string, userId: string) {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId } });

  if (!note) {
    console.error(`[Video] Note ${noteId} not found`);
    return;
  }

  if (!note.sourceUrl) {
    await skipJob(noteId, "transcribe", "Bu notta video linki yok.");
    await updateStatus(noteId, "ready");
    return;
  }

  const dir = noteMediaDir(noteId);
  let audioPath: string | null = null;

  await createJob(noteId, "transcribe", "running", "Video bilgisi alınıyor...");

  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
    });
    const maxDuration = settings?.maxVideoDuration ?? 3600;

    // 1) Meta veri: uzun videolar indirilmeden once elenir
    const info = await probeVideo(note.sourceUrl);

    if (info.durationSeconds && info.durationSeconds > maxDuration) {
      throw new MediaError(
        `Video çok uzun (${Math.round(info.durationSeconds / 60)} dk). ` +
          `Sınır ${Math.round(maxDuration / 60)} dk.`
      );
    }

    await ensureDir(dir);

    // Yeniden calistirildiginda eski medya kayitlari birikmesin
    await prisma.noteMedia.deleteMany({ where: { noteId } });

    // Gomulu oynatilabilen kaynaklarda video dosyasi saklanmiyor
    const embeddable = youtubeVideoId(note.sourceUrl) !== null;

    // 2) Altyazi yolu
    let segments: Segment[] | null = null;
    let sourceLanguage: string | null = null;
    let fromCaptions = false;

    const choice = pickCaptionLanguage(info);

    if (choice) {
      await progressJob(
        noteId,
        "transcribe",
        choice.manual ? "Altyazı indiriliyor..." : "Otomatik altyazı indiriliyor...",
        20
      );

      const captions = await fetchCaptions(note.sourceUrl, dir, choice);

      if (captions) {
        segments = captions.segments;
        // "en-US" gibi bolgesel varyantlari iki harfe indirir
        sourceLanguage = choice.lang.split("-")[0].toLowerCase();
        fromCaptions = true;
      }
    }

    // 3) Video dosyasi — izlemek icin, altyazidan bagimsiz.
    //    YouTube'da indirmiyoruz: medya akisi 403 donuyor ve zaten oynatici
    //    not detayina gomulu geliyor (bkz. youtube-player.tsx). Diger
    //    kaynaklarda izlemenin baska yolu olmadigi icin indiriyoruz.
    let videoPath: string | null = null;

    if (!embeddable) {
      try {
        await updateStatus(noteId, "downloading");
        await progressJob(noteId, "transcribe", "Video indiriliyor...", 40);
        const video = await downloadVideo(note.sourceUrl, dir);
        videoPath = video.filePath;

        await prisma.noteMedia.create({
          data: {
            noteId,
            mediaType: "video",
            storagePath: path.relative(getStoragePath(), video.filePath),
            mimeType: "video/mp4",
            duration: info.durationSeconds,
            size: video.sizeBytes,
          },
        });
      } catch (error) {
        // Altyazi elimizdeyse indirme basarisizligi olumcul degil: not yine
        // ozetlenebilir, sadece izlenemez
        if (!segments) throw error;
        console.warn(
          `[Video] ${noteId}: video indirilemedi, altyazıyla devam ediliyor:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    // 4) Konusma yolu — yalnizca altyazi bulunamadiginda
    if (!segments) {
      if (!videoPath) {
        throw new MediaError(
          "Videonun altyazısı yok ve dosyası indirilemediği için konuşma çözümlenemiyor."
        );
      }

      const whisper = await resolveTranscription(userId);

      if (!whisper) {
        await skipJob(
          noteId,
          "transcribe",
          (choice
            ? "Videonun altyazısı indirilemedi. "
            : "Bu videoda altyazı yok. ") +
            "Konuşma tanıma OpenAI Whisper ile yapılıyor; Ayarlar sayfasından " +
            "OpenAI API anahtarınızı ekleyin (metin işlemleri için başka bir " +
            "sağlayıcı seçmiş olsanız bile)."
        );
        // Video indi, altyazisiz da olsa izlenebilsin
        await prisma.note.update({
          where: { id: noteId },
          data: { type: "video", title: note.title || info.title },
        });
        await updateStatus(noteId, "ready");
        return;
      }

      await updateStatus(noteId, "extracting");
      await progressJob(noteId, "transcribe", "Ses ayrıştırılıyor...", 55);
      const audio = await extractAudio(videoPath, dir);
      audioPath = audio.filePath;

      await updateStatus(noteId, "transcribing");
      await progressJob(noteId, "transcribe", "Konuşma çözümleniyor...", 65);
      const transcription = await transcribeAudio(
        whisper.apiKey,
        whisper.model,
        audio.filePath
      );

      if (transcription.segments.length === 0) {
        throw new Error("Videoda konuşma bulunamadı");
      }

      segments = transcription.segments;
      sourceLanguage = transcription.language?.toLowerCase().slice(0, 2) || null;
    }

    const originalText = segments.map((s) => s.text).join(" ");
    const originalVttPath = path.join(dir, "original.vtt");
    await writeFile(originalVttPath, buildVtt(segments), "utf-8");

    // 5) Ceviri — kaynak zaten hedef dildeyse veya saglayici yoksa atlanir
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const targetLanguage = user?.translationLanguage || "tr";
    const target = targetLanguage.toLowerCase().slice(0, 2);

    let translatedSegments: Segment[] | null = null;
    let translatedVttPath: string | null = null;
    let translationNote = "";

    if (sourceLanguage && sourceLanguage === target) {
      translationNote = `konuşma zaten ${targetLanguage} dilinde, çeviri atlandı`;
    } else {
      // Altyazi cevirisi "ceviri" isinin saglayicisini kullanir
      const ai = await resolveAi(userId, "translate");

      if (!ai) {
        translationNote =
          "çeviri için AI sağlayıcı anahtarı tanımlı olmadığından yalnızca " +
          "kaynak dildeki altyazı hazırlandı";
      } else {
        await updateStatus(noteId, "translating");
        await progressJob(noteId, "transcribe", "Altyazı çevriliyor...", 75);

        translatedSegments = await translateSegments(
          ai.config,
          segments,
          targetLanguage
        );
        translatedVttPath = path.join(dir, "translated.vtt");
        await writeFile(translatedVttPath, buildVtt(translatedSegments), "utf-8");
      }
    }

    // 6) Kayit. Iki altyazi da NoteMedia olarak yazilir ki oynatici ikisini de
    //    ayri parca olarak sunabilsin.
    await prisma.transcript.deleteMany({ where: { noteId } });
    await prisma.transcript.create({
      data: {
        noteId,
        language: sourceLanguage || "bilinmiyor",
        transcriptText: originalText,
        translatedText: translatedSegments
          ? translatedSegments.map((s) => s.text).join(" ")
          : null,
        subtitleVttPath: path.relative(getStoragePath(), originalVttPath),
      },
    });

    await prisma.noteMedia.create({
      data: {
        noteId,
        mediaType: "subtitle_original",
        storagePath: path.relative(getStoragePath(), originalVttPath),
        mimeType: "text/vtt",
      },
    });

    if (translatedVttPath) {
      await prisma.noteMedia.create({
        data: {
          noteId,
          mediaType: "subtitle_translated",
          storagePath: path.relative(getStoragePath(), translatedVttPath),
          mimeType: "text/vtt",
        },
      });
    }

    await prisma.note.update({
      where: { id: noteId },
      data: {
        type: "video",
        title: note.title || info.title,
        coverImage: note.coverImage || info.thumbnail,
        languageDetected: sourceLanguage,
        errorText: null,
      },
    });

    const how = fromCaptions
      ? choice?.manual
        ? "sitenin altyazısından"
        : "sitenin otomatik altyazısından"
      : "konuşma tanımayla";

    await completeJob(
      noteId,
      "transcribe",
      `Altyazı hazır — ${how}, ${segments.length} satır` +
        (translationNote ? ` (${translationNote})` : "")
    );
    await updateStatus(noteId, "ready");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bilinmeyen video hatası";
    console.error(`[Video] ${noteId}:`, message);

    await failJob(noteId, "transcribe", message);
    await prisma.note.update({
      where: { id: noteId },
      data: { status: "failed", errorText: message },
    });
  } finally {
    // Ses dosyasi yalnizca transkripsiyon icin uretiliyor, saklanmiyor
    if (audioPath) {
      await rm(audioPath, { force: true }).catch(() => {});
    }
  }
}
