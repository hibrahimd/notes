/**
 * Tweet medyasini cikarir.
 *
 * Neden ayri bir yol: yt-dlp X'te yalnizca videoyu goruyor, fotograflari hic
 * bildirmiyor. Cektigimiz HTML de ise yaramiyor cunku X sayfayi JavaScript ile
 * kuruyor; OpenGraph etiketlerinden tek bir gorsel cikiyor. Dort fotografli
 * bir tweet bu yuzden tek kapak gorseliyle kaydediliyordu.
 *
 * Kullanilan uc nokta X'in gomulu tweet bilesenini besleyen genel uc nokta.
 * Belgelenmis bir API degil, bu yuzden her cagri hataya dayanikli: cevap
 * beklenen bicimde gelmezse null donuyor ve not eski akisla isleniyor.
 */

const SYNDICATION_URL = "https://cdn.syndication.twimg.com/tweet-result";

// Uc nokta tarayici disindan gelen istekleri reddedebiliyor
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface TweetMedia {
  /** Tweet'in tam metni — OpenGraph aciklamasi kirpiliyor */
  text: string | null;
  authorName: string | null;
  photoUrls: string[];
  hasVideo: boolean;
}

/** X gonderi adresinden tweet kimligini cikarir, tweet degilse null doner. */
export function tweetId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^mobile\./, "");

    if (host !== "x.com" && host !== "twitter.com") return null;

    const match = parsed.pathname.match(/\/status(?:es)?\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

interface SyndicationPhoto {
  url?: unknown;
}

interface SyndicationResponse {
  text?: unknown;
  user?: { name?: unknown };
  photos?: unknown;
  video?: unknown;
  mediaDetails?: unknown;
}

function photoUrlsFrom(data: SyndicationResponse): string[] {
  const urls: string[] = [];

  // photos yalnizca fotograflari, mediaDetails video kapaklarini da iceriyor;
  // ikisi de gelebiliyor, tekrarlar eleniyor
  const candidates: unknown[] = [];
  if (Array.isArray(data.photos)) candidates.push(...data.photos);
  if (Array.isArray(data.mediaDetails)) {
    for (const item of data.mediaDetails) {
      if (
        item &&
        typeof item === "object" &&
        (item as { type?: unknown }).type === "photo"
      ) {
        candidates.push(item);
      }
    }
  }

  for (const candidate of candidates) {
    const url = (candidate as SyndicationPhoto)?.url;
    if (typeof url === "string" && url.startsWith("https://") && !urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

export async function fetchTweetMedia(url: string): Promise<TweetMedia | null> {
  const id = tweetId(url);
  if (!id) return null;

  try {
    const response = await fetch(
      `${SYNDICATION_URL}?id=${id}&token=a&lang=tr`,
      {
        headers: { "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as SyndicationResponse;

    return {
      text: typeof data.text === "string" ? data.text : null,
      authorName:
        data.user && typeof data.user.name === "string" ? data.user.name : null,
      photoUrls: photoUrlsFrom(data),
      hasVideo: Boolean(data.video),
    };
  } catch (error) {
    console.warn(
      "[twitter] Tweet medyası alınamadı:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/** Fotograflari orijinal boyutta ister; varsayilan adres kirpilmis geliyor. */
export function originalSizeUrl(photoUrl: string): string {
  try {
    const parsed = new URL(photoUrl);
    parsed.searchParams.set("name", "orig");
    return parsed.toString();
  } catch {
    return photoUrl;
  }
}
