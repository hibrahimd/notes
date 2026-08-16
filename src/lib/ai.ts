import { openaiChat, OPENAI_DEFAULT_MODEL } from "./openai";
import { anthropicChat, ANTHROPIC_DEFAULT_MODEL } from "./anthropic";

/**
 * Metin islerinde (ozet, ceviri, kategori) saglayici bagimsiz katman.
 *
 * Konusma tanima bu katmanda degil: Anthropic'in konusma tanima API'si yok,
 * transkripsiyon her zaman OpenAI Whisper ile yapiliyor (bkz. transcribe.ts).
 */

export type AiProvider = "openai" | "anthropic";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export function defaultModelFor(provider: AiProvider): string {
  return provider === "anthropic" ? ANTHROPIC_DEFAULT_MODEL : OPENAI_DEFAULT_MODEL;
}

export interface ChatOptions {
  maxTokens?: number;
  /** true ise model gecerli JSON dondurmeye tesvik edilir */
  json?: boolean;
}

export async function chat(
  config: AiConfig,
  prompt: string,
  options: ChatOptions = {}
): Promise<string> {
  const { maxTokens = 2000, json = false } = options;

  if (config.provider === "anthropic") {
    // Anthropic'te JSON modu yok; istenen bicim prompt'ta belirtiliyor ve
    // cagiran taraf parse hatasina karsi zaten korumali
    const suffix = json
      ? "\n\nYalnızca geçerli JSON döndür. Açıklama, kod bloğu işareti veya başka metin ekleme."
      : "";
    return anthropicChat(config.apiKey, config.model, prompt + suffix, maxTokens);
  }

  return openaiChat(config.apiKey, config.model, prompt, maxTokens, json);
}

/** JSON bekleyen cagrilar icin: parse edilemezse null doner. */
export async function chatJson<T>(
  config: AiConfig,
  prompt: string,
  options: ChatOptions = {}
): Promise<T | null> {
  const raw = await chat(config, prompt, { ...options, json: true });
  if (!raw) return null;

  // Bazi modeller JSON'u kod blogu icinde donduruyor
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error("[ai] JSON parse edilemedi:", cleaned.slice(0, 200));
    return null;
  }
}

/** Metni paragraf sinirlarinda, verilen karakter butcesine gore parcalara boler. */
export function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of text.split(/\n\s*\n/)) {
    // Tek basina butceyi asan paragrafi cumle sinirlarinda boler
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      let rest = paragraph;
      while (rest.length > maxChars) {
        const window = rest.slice(0, maxChars);
        const breakAt = Math.max(
          window.lastIndexOf(". "),
          window.lastIndexOf("! "),
          window.lastIndexOf("? "),
          window.lastIndexOf("\n")
        );
        const cut = breakAt > maxChars * 0.5 ? breakAt + 1 : maxChars;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut);
      }
      current = rest;
      continue;
    }

    if (current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current.trim()) chunks.push(current);
  return chunks;
}

const TRANSLATION_CHUNK_CHARS = 4000;
const MAX_TRANSLATION_CHUNKS = 15;

export interface TranslationResult {
  text: string;
  /** Metin uzunluk siniri nedeniyle kirpildiysa true */
  truncated: boolean;
  chunkCount: number;
}

/**
 * Uzun metinleri parca parca cevirir. Tek cagrida cevirmek, cikti token limiti
 * yuzunden ceviriyi sessizce yarida kesiyordu.
 */
export async function translateLongText(
  config: AiConfig,
  text: string,
  targetLanguage: string
): Promise<TranslationResult> {
  const allChunks = chunkText(text, TRANSLATION_CHUNK_CHARS);
  const chunks = allChunks.slice(0, MAX_TRANSLATION_CHUNKS);
  const truncated = allChunks.length > chunks.length;

  const translated: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const part = await chat(
      config,
      `Aşağıdaki metni ${targetLanguage} diline çevir. Sadece çevirinin kendisini döndür, ` +
        `açıklama veya başlık ekleme. Paragraf yapısını koru.` +
        (chunks.length > 1
          ? `\n\n(Bu, ${chunks.length} parçadan ${index + 1}. parçadır; metnin ortasından başlıyor olabilir.)`
          : "") +
        `\n\n${chunk}`,
      { maxTokens: 4000 }
    );
    translated.push(part);
  }

  return {
    text: translated.join("\n\n"),
    truncated,
    chunkCount: chunks.length,
  };
}
