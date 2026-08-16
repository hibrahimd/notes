/**
 * Adresleri karsilastirilabilir hale getirir.
 *
 * Ayni icerik farkli adreslerle geliyor: paylas dugmesi izleme parametresi
 * ekliyor ("?s=12"), bazi kaynaklar "www." koyuyor, bazilari sonuna egik
 * cizgi. Ham metin karsilastirmasi bunlari ayri not sayiyordu.
 */

/**
 * Icerigi degistirmeyen, yalnizca nereden gelindigini kaydeden parametreler.
 * Silinmeleri adresi bozmuyor.
 */
const TRACKING_PARAMS = new Set([
  "s",
  "t",
  "si",
  "ref",
  "ref_src",
  "ref_url",
  "source",
  "feature",
  "spm",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "cmpid",
  "at_medium",
  "at_campaign",
]);

/**
 * Karsilastirma anahtari uretir. Adresin kendisi degismiyor; bu yalnizca
 * "ayni sey mi" sorusunun cevabi icin.
 *
 * @returns cozumlenemeyen adreslerde kirpilmis ham metin
 */
export function urlKey(rawUrl: string): string {
  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  // Kalan parametreler siralaniyor: sira degisikligi ayni adresi farkli
  // gostermesin
  const params = [...parsed.searchParams.entries()]
    .filter(
      ([key]) =>
        !TRACKING_PARAMS.has(key.toLowerCase()) &&
        !key.toLowerCase().startsWith("utm_")
    )
    .sort(([a], [b]) => a.localeCompare(b));

  const query = new URLSearchParams(params).toString();

  // Sondaki egik cizgi ve parca (#) icerigi degistirmiyor
  const path = parsed.pathname.replace(/\/+$/, "");

  return `${host}${path}${query ? `?${query}` : ""}`;
}
