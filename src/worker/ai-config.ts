import { tryDecrypt } from "../lib/crypto";
import { defaultModelFor, isProvider } from "../lib/ai-models";
import type { AiConfig, AiProvider } from "../lib/ai";
import { prisma } from "./db";

/**
 * Hangi is icin hangi saglayici, anahtar ve modelin kullanilacagini cozer.
 * Hem not hem video islemcisi kullandigi icin ayri dosyada: aksi halde
 * ikisi birbirini import edip dongu olusuyor.
 */

interface AiContext {
  config: AiConfig;
  /** Anahtarin nereden geldigi; kullaniciya gosterilir */
  source: "user" | "system";
}

/** Ayarlarda ayri ayri secilebilen isler. */
export type AiTask = "summarize" | "translate" | "categorize";

/**
 * Bir is icin saglayici, anahtar ve modeli cozer. Her is ayri
 * secilebiliyor: kategori kolay bir siniflandirma, ceviri ise en zor is.
 * Anahtar once kullanici ayarlarindan, yoksa sistem ayarlarindan alinir.
 */
export async function resolveAi(
  userId: string,
  task: AiTask
): Promise<AiContext | null> {
  const [systemSettings, userSettings] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { id: "default" } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  const rawProvider =
    task === "summarize"
      ? userSettings?.summarizeProvider
      : task === "translate"
        ? userSettings?.translateProvider
        : userSettings?.categorizeProvider;

  const rawModel =
    task === "summarize"
      ? userSettings?.summarizeModel
      : task === "translate"
        ? userSettings?.translateModel
        : userSettings?.categorizeModel;

  const provider: AiProvider = isProvider(rawProvider) ? rawProvider : "openai";
  const model = rawModel?.trim() || defaultModelFor(provider);

  const userKey = tryDecrypt(
    provider === "anthropic"
      ? userSettings?.anthropicApiKeyEncrypted
      : userSettings?.openaiApiKeyEncrypted
  );
  if (userKey) {
    return { config: { provider, apiKey: userKey, model }, source: "user" };
  }

  const systemKey = tryDecrypt(
    provider === "anthropic"
      ? systemSettings?.anthropicApiKey
      : systemSettings?.openaiApiKey
  );
  if (systemKey) {
    return { config: { provider, apiKey: systemKey, model }, source: "system" };
  }

  return null;
}

/**
 * Konusma tanima her zaman OpenAI Whisper ile yapilir; Anthropic'in konusma
 * tanima API'si yok, dolayisiyla video icin OpenAI anahtari gerekiyor.
 */
export async function resolveTranscription(
  userId: string
): Promise<{ apiKey: string; model: string } | null> {
  const [systemSettings, userSettings] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { id: "default" } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  const apiKey =
    tryDecrypt(userSettings?.openaiApiKeyEncrypted) ||
    tryDecrypt(systemSettings?.openaiApiKey);

  if (!apiKey) return null;

  return { apiKey, model: userSettings?.transcribeModel?.trim() || "whisper-1" };
}

