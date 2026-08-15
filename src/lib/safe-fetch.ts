import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Kullanicidan gelen URL'leri cekerken SSRF korumasi.
 *
 * Worker, kullanicinin paylastigi her linki sunucudan fetch ediyor. Filtre
 * olmadan bu, ic aga (postgres, redis, cloud metadata servisi) istek atmak icin
 * kullanilabilir. Burada hem sema hem de cozumlenen IP adresi dogrulanir ve
 * yonlendirmeler her adimda yeniden kontrol edilir.
 */

const MAX_REDIRECTS = 5;

function isBlockedIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // ozel
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // ozel
  if (a === 192 && b === 168) return true; // ozel
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // IETF protokol atamalari
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast + rezerve

  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");

  if (normalized === "::" || normalized === "::1") return true; // unspecified + loopback

  // IPv4-mapped (::ffff:10.0.0.1) adresleri IPv4 kurallariyla degerlendir
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);

  if (normalized.startsWith("fe80")) return true; // link-local
  if (/^f[cd]/.test(normalized)) return true; // unique local
  if (normalized.startsWith("ff")) return true; // multicast

  return false;
}

function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true; // cozumlenemeyen adres
}

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/** URL'in semasini ve hedef IP adres(ler)ini dogrular. */
export async function assertUrlIsSafe(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("Gecersiz URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Desteklenmeyen protokol: ${url.protocol}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  // Hostname zaten bir IP ise dogrudan kontrol et
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new BlockedUrlError(`Ic ag adresine erisim engellendi: ${hostname}`);
    }
    return url;
  }

  let addresses;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedUrlError(`Alan adi cozumlenemedi: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError(`Alan adi cozumlenemedi: ${hostname}`);
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new BlockedUrlError(
        `Ic ag adresine erisim engellendi: ${hostname} -> ${address}`
      );
    }
  }

  return url;
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SafeFetchResult {
  /** Yonlendirmeler sonrasi ulasilan son URL */
  finalUrl: string;
  status: number;
  contentType: string | null;
  body: string;
}

/**
 * Yonlendirmeleri elle takip ederek her adimda hedefi yeniden dogrulayan fetch.
 * `redirect: "follow"` kullanilsaydi, guvenli bir alan adi 127.0.0.1'e
 * yonlendirerek kontrolu atlayabilirdi.
 */
export async function safeFetchText(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const { headers = {}, timeoutMs = 15000, maxBytes = 5 * 1024 * 1024 } = options;

  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertUrlIsSafe(currentUrl);

    const response = await fetch(url, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new BlockedUrlError("Yonlendirme adresi eksik");
      }
      currentUrl = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > maxBytes) {
      throw new Error(
        `Icerik cok buyuk: ${Math.round(declaredLength / 1024 / 1024)}MB`
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error("Icerik izin verilen boyutu asiyor");
    }

    return {
      finalUrl: url.toString(),
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: new TextDecoder().decode(buffer),
    };
  }

  throw new BlockedUrlError("Cok fazla yonlendirme");
}
