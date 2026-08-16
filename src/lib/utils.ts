import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 6 haneli giris kodu. Math.random() tahmin edilebilir oldugu icin kripto
 * guvenli kaynak kullanilir; modulo sapmasini onlemek uzere ust aralik elenir.
 */
export function generateCode(): string {
  const range = 900000;
  const limit = Math.floor(0xffffffff / range) * range;
  const buffer = new Uint32Array(1);

  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return (100000 + (value % range)).toString();
}

/**
 * metadataJson serbest bicimli JSON oldugu icin tipi daraltilamiyor;
 * aciklama alanini calisma zamaninda guvenli sekilde okur.
 */
export function metaDescription(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).description;
  return typeof value === "string" && value.trim() ? value : null;
}

export function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

/**
 * YouTube URL'sinden video kimligini cikarir, YouTube degilse null doner.
 *
 * YouTube sunucu IP'lerinden medya akisini kapatiyor, yani videoyu kendimiz
 * barindiramiyoruz. Bu kimlikle oynaticiyi gomup altyaziyi ustune biniyoruz.
 */
export function youtubeVideoId(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }

    if (host !== "youtube.com" && host !== "music.youtube.com") return null;

    const v = parsed.searchParams.get("v");
    if (v) return v;

    // /shorts/<id>, /embed/<id>, /live/<id>
    const match = parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
