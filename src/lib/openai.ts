/**
 * OpenAI chat completions icin ince sarmalayici.
 *
 * Worker tarafindan kullanilir; `@/` takma adlarina bagli degildir ki tsx ile
 * dogrudan calistirilabilsin.
 */

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  /** true ise model gecerli JSON dondurmeye zorlanir */
  json?: boolean;
}

export async function chat(
  config: OpenAIConfig,
  prompt: string,
  options: ChatOptions = {}
): Promise<string> {
  const { maxTokens = 2000, temperature = 0.3, json = false } = options;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API hatasi: ${response.status} ${err}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (choice?.finish_reason === "length") {
    console.warn("[openai] Yanit token limitine takildi, cikti kirpilmis olabilir");
  }

  return choice?.message?.content?.trim() || "";
}

/** JSON bekleyen cagrilar icin: parse edilemezse null doner. */
export async function chatJson<T>(
  config: OpenAIConfig,
  prompt: string,
  options: ChatOptions = {}
): Promise<T | null> {
  const raw = await chat(config, prompt, { ...options, json: true });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.error("[openai] JSON parse edilemedi:", raw.slice(0, 200));
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
  config: OpenAIConfig,
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
      `Asagidaki metni ${targetLanguage} diline cevir. Sadece cevirinin kendisini dondur, ` +
        `aciklama veya baslik ekleme. Paragraf yapisini koru.` +
        (chunks.length > 1
          ? `\n\n(Bu, ${chunks.length} parcadan ${index + 1}. parcadir; metnin ortasindan basliyor olabilir.)`
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
