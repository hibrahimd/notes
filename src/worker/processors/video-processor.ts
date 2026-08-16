import { rm, writeFile } from "fs/promises";
import path from "path";
import { getStoragePath, ensureDir } from "../../lib/storage";
import {
  probeVideo,
  downloadVideo,
  extractAudio,
  buildVtt,
  MediaError,
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

/**
 * Video isleme hatti: indir -> sesi cikar -> transkript -> ceviri -> altyazi.
 *
 * Talep uzerine calisir; otomatik degil. Videolar diske yazildigi icin her
 * notun dosyalari kendi klasorunde tutulur ve not silindiginde birlikte gider.
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

  // Altyazi cevirisi "ceviri" isinin saglayicisini kullanir
  const ai = await resolveAi(userId, "translate");
  if (!ai) {
    await skipJob(
      noteId,
      "transcribe",
      "AI sağlayıcı anahtarı tanımlı değil; altyazı çevirisi yapılamıyor."
    );
    await updateStatus(noteId, "ready");
    return;
  }

  // Konusma tanima yalnizca Whisper ile yapiliyor: metin saglayicisi Anthropic
  // secilmis olsa bile burada OpenAI anahtari sart
  const transcription$ = await resolveTranscription(userId);
  if (!transcription$) {
    await skipJob(
      noteId,
      "transcribe",
      "Video transkripsiyonu OpenAI Whisper ile yapılıyor. Ayarlar sayfasından " +
        "OpenAI API anahtarınızı ekleyin (metin işlemleri için başka bir sağlayıcı seçmiş olsanız bile)."
    );
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

    // 2) Indirme
    await updateStatus(noteId, "downloading");
    await progressJob(noteId, "transcribe", "Video indiriliyor...", 10);
    const video = await downloadVideo(note.sourceUrl, dir);

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

    // 3) Ses
    await updateStatus(noteId, "extracting");
    await progressJob(noteId, "transcribe", "Ses ayrıştırılıyor...", 35);
    const audio = await extractAudio(video.filePath, dir);
    audioPath = audio.filePath;

    // 4) Transkript
    await updateStatus(noteId, "transcribing");
    await progressJob(noteId, "transcribe", "Konuşma çözümleniyor...", 50);
    const transcription = await transcribeAudio(
      transcription$.apiKey,
      transcription$.model,
      audio.filePath
    );

    if (transcription.segments.length === 0) {
      throw new Error("Videoda konuşma bulunamadı");
    }

    const originalVtt = buildVtt(transcription.segments);
    const originalVttPath = path.join(dir, "original.vtt");
    await writeFile(originalVttPath, originalVtt, "utf-8");

    // 5) Ceviri
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const targetLanguage = user?.translationLanguage || "tr";

    await updateStatus(noteId, "translating");
    await progressJob(noteId, "transcribe", "Altyazı çevriliyor...", 75);

    const translatedSegments = await translateSegments(
      ai.config,
      transcription.segments,
      targetLanguage
    );
    const translatedVttPath = path.join(dir, "translated.vtt");
    await writeFile(translatedVttPath, buildVtt(translatedSegments), "utf-8");

    // 6) Kayit. Iki altyazi da NoteMedia olarak yazilir ki oynatici ikisini de
    //    ayri parca olarak sunabilsin.
    await prisma.transcript.deleteMany({ where: { noteId } });
    await prisma.transcript.create({
      data: {
        noteId,
        language: transcription.language || "bilinmiyor",
        transcriptText: transcription.text,
        translatedText: translatedSegments.map((s) => s.text).join(" "),
        subtitleVttPath: path.relative(getStoragePath(), originalVttPath),
      },
    });

    await prisma.noteMedia.createMany({
      data: [
        {
          noteId,
          mediaType: "subtitle_original",
          storagePath: path.relative(getStoragePath(), originalVttPath),
          mimeType: "text/vtt",
        },
        {
          noteId,
          mediaType: "subtitle_translated",
          storagePath: path.relative(getStoragePath(), translatedVttPath),
          mimeType: "text/vtt",
        },
      ],
    });

    await prisma.note.update({
      where: { id: noteId },
      data: {
        type: "video",
        title: note.title || info.title,
        coverImage: note.coverImage || info.thumbnail,
        languageDetected: transcription.language,
        errorText: null,
      },
    });

    await completeJob(
      noteId,
      "transcribe",
      `Altyazı hazır (${transcription.segments.length} satır)`
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
