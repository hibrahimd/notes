import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic tasiyicisi.
 *
 * Modele ozgu iki kural var:
 * - `temperature` / `top_p` guncel modellerde reddediliyor (400), gonderilmiyor.
 * - Dusunme varsayilan olarak acik ve `max_tokens` dusunme + yaniti birlikte
 *   sinirliyor. Ozet/ceviri gibi rutin islerde derin dusunmeye gerek yok, o
 *   yuzden effort "low" veriliyor; dusunmeyi tamamen kapatmak yerine bu tercih
 *   ediliyor cunku kapaliyken model bazen ic etiketlerini yanita sizdiriyor.
 *   Yine de butceye pay birakmak icin max_tokens'a ek alan ekleniyor.
 */

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5";

/** Dusunmenin cikti butcesini yemesi icin ayrilan pay. */
const THINKING_HEADROOM = 4000;

export async function anthropicChat(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create(
    {
      model,
      max_tokens: maxTokens + THINKING_HEADROOM,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    },
    { timeout: 180000 }
  );

  if (response.stop_reason === "refusal") {
    throw new Error("Model isteği reddetti");
  }

  if (response.stop_reason === "max_tokens") {
    console.warn("[anthropic] Yanit token limitine takildi, cikti kirpilmis olabilir");
  }

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
