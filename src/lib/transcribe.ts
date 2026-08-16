import { readFile } from "fs/promises";
import path from "path";
import { chatJson, type OpenAIConfig } from "./openai";
import type { Segment } from "./media";

/**
 * Konusma tanima ve altyazi cevirisi.
 *
 * Ceviri segment segment yapilir: tum metni tek parca cevirip sonra bolmek
 * zaman damgalarini kaydiriyor ve altyazi videoyla senkronunu kaybediyor.
 */

/** OpenAI ses dosyasi siniri 25 MB. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Tek istekte cevrilecek altyazi satiri sayisi. */
const TRANSLATION_BATCH = 40;

export interface Transcription {
  language: string | null;
  text: string;
  segments: Segment[];
}

export async function transcribeAudio(
  config: OpenAIConfig,
  audioPath: string
): Promise<Transcription> {
  const buffer = await readFile(audioPath);

  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error(
      `Ses dosyası çok büyük (${Math.round(buffer.byteLength / 1024 / 1024)}MB). ` +
        "Daha kısa bir video deneyin."
    );
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), path.basename(audioPath));
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(600000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Transkripsiyon hatası: ${response.status} ${err.slice(0, 300)}`);
  }

  const data = await response.json();

  const segments: Segment[] = Array.isArray(data.segments)
    ? data.segments.map((s: { start: number; end: number; text: string }) => ({
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text || "").trim(),
      }))
    : [];

  return {
    language: typeof data.language === "string" ? data.language : null,
    text: String(data.text || ""),
    segments,
  };
}

/**
 * Altyazi satirlarini zaman damgalarini bozmadan cevirir. Her parti,
 * numarali bir JSON nesnesi olarak gonderilip ayni anahtarlarla geri istenir;
 * boylece satir sayisi ve sirasi korunur.
 */
export async function translateSegments(
  config: OpenAIConfig,
  segments: Segment[],
  targetLanguage: string
): Promise<Segment[]> {
  const translated: Segment[] = [];

  for (let i = 0; i < segments.length; i += TRANSLATION_BATCH) {
    const batch = segments.slice(i, i + TRANSLATION_BATCH);

    const payload: Record<string, string> = {};
    batch.forEach((segment, index) => {
      payload[String(index)] = segment.text;
    });

    const result = await chatJson<Record<string, string>>(
      config,
      `Aşağıdaki altyazı satırlarını ${targetLanguage} diline çevir.\n` +
        `Aynı anahtarlara sahip bir JSON nesnesi döndür; hiçbir anahtarı atlama, ` +
        `birleştirme veya bölme. Her değer yalnızca o satırın çevirisi olsun.\n\n` +
        JSON.stringify(payload),
      { maxTokens: 4000 }
    );

    batch.forEach((segment, index) => {
      const value = result?.[String(index)];
      translated.push({
        ...segment,
        // Ceviri gelmediyse orijinal satir korunur, altyazi bosalmasin
        text: typeof value === "string" && value.trim() ? value.trim() : segment.text,
      });
    });
  }

  return translated;
}
