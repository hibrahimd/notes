import type { AiProvider } from "./ai";

/**
 * Ayarlar sayfasindaki model listeleri.
 *
 * Liste bilerek kisa tutuldu: yalnizca varligindan emin oldugum model
 * kimlikleri var. Saglayicilar sik sik yeni model cikardigi icin her seceneğe
 * "Diğer" ile elle giris imkani birakildi — yanlis bir kimlik yazilirsa istek
 * hata doner ve kullanici bunu not detayinda gorur.
 */

export interface ModelOption {
  id: string;
  label: string;
  hint?: string;
}

export const OPENAI_MODELS: ModelOption[] = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini", hint: "Ucuz ve hızlı" },
  { id: "gpt-4o", label: "gpt-4o", hint: "Daha güçlü" },
];

export const ANTHROPIC_MODELS: ModelOption[] = [
  { id: "claude-haiku-4-5", label: "claude-haiku-4-5", hint: "En ucuz" },
  { id: "claude-sonnet-5", label: "claude-sonnet-5", hint: "Dengeli — önerilen" },
  { id: "claude-opus-5", label: "claude-opus-5", hint: "En güçlü" },
];

/** Konusma tanima icin: altyazi zaman damgalarini yalnizca bu model donduruyor. */
// Saglayici adi etikete yaziliyor: bu listede secim yalnizca model bazinda
// oldugu icin modelin kime ait oldugu baska yerden anlasilmiyor
export const TRANSCRIBE_MODELS: ModelOption[] = [
  {
    id: "whisper-1",
    label: "OpenAI whisper-1",
    hint: "Zaman damgalı segment desteği",
  },
];

export function modelsFor(provider: AiProvider): ModelOption[] {
  return provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;
}

export function defaultModelFor(provider: AiProvider): string {
  return provider === "anthropic" ? "claude-sonnet-5" : "gpt-4o-mini";
}

export const DEFAULT_TRANSCRIBE_MODEL = "whisper-1";

export function isProvider(value: unknown): value is AiProvider {
  return value === "openai" || value === "anthropic";
}
