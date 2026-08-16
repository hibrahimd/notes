/**
 * OpenAI tasiyicisi.
 *
 * Metin isleri saglayici bagimsiz katmandan (ai.ts) gecer; bu dosya yalnizca
 * OpenAI'ye giden HTTP cagrisini yapar. Konusma tanima da OpenAI'ye ozgudur
 * ve transcribe.ts icinde durur.
 */

export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export async function openaiChat(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
  json: boolean
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
      max_tokens: maxTokens,
      temperature: 0.3,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API hatası: ${response.status} ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (choice?.finish_reason === "length") {
    console.warn("[openai] Yanit token limitine takildi, cikti kirpilmis olabilir");
  }

  return choice?.message?.content?.trim() || "";
}
