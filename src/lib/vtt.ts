/**
 * WebVTT okuma/yazma. Node bagimliligi yok: hem worker hem tarayici kullanir.
 *
 * Tarayici tarafinda gerekiyor cunku YouTube videolarinda oynatici gomulu
 * geliyor ve altyazilari kendimiz bindiriyoruz (bkz. youtube-player.tsx).
 */

export interface Segment {
  start: number;
  end: number;
  text: string;
}

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const millis = Math.round((total - Math.floor(total)) * 1000);

  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(millis, 3)}`;
}

export function buildVtt(segments: Segment[]): string {
  const cues = segments
    .filter((s) => s.text.trim())
    .map(
      (s, i) =>
        `${i + 1}\n${formatTimestamp(s.start)} --> ${formatTimestamp(s.end)}\n${s.text.trim()}`
    );

  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

const VTT_TIMING =
  /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3})\s+-->\s+(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3})/;

function vttSeconds(
  hours: string | undefined,
  minutes: string,
  seconds: string,
  millis: string
): number {
  return (
    Number(hours || 0) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis.padEnd(3, "0")) / 1000
  );
}

/** Cue metnindeki bicim etiketlerini ve HTML varliklarini temizler. */
function cleanCueLine(line: string): string {
  return line
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * WebVTT dosyasini segmentlere cevirir.
 *
 * YouTube'un otomatik altyazilari "yuvarlanan" bicimde gelir: her cue'nun ilk
 * satiri bir onceki cue'nun tamamlanmis metnini tekrar eder, yeni metin son
 * satirdadir ve kelime kelime <c> etiketleriyle zamanlanmistir. Aralara da
 * 10 ms'lik saf tekrar cue'lari serpistirilir. Butun satirlari birlestirmek
 * metni ikiye katliyor; bu yuzden bu bicim tespit edilince yalnizca son satir
 * aliniyor. Insan yazimi altyazilarda bu yapi olmadigi icin satirlar normal
 * sekilde birlestiriliyor.
 */
export function parseVtt(content: string): Segment[] {
  const rolling = content.includes("<c>");
  const segments: Segment[] = [];

  // Cue'lar bos satirla ayrilir. Bolme sirasinda satirin bosluk icermemesi
  // sart: YouTube cue govdesinin ilk satirina tek bosluk koyuyor ve bos satir
  // sayilirsa cue ikiye bolunup metni kayboluyor.
  for (const block of content.split(/\r?\n\r?\n+/)) {
    const lines = block.split(/\r?\n/);
    // Zamanlama satirindan onceki cue kimligi varsa atlanir
    const timingIndex = lines.findIndex((l) => VTT_TIMING.test(l.trim()));
    if (timingIndex === -1) continue;

    const match = VTT_TIMING.exec(lines[timingIndex].trim());
    if (!match) continue;

    const start = vttSeconds(match[1], match[2], match[3], match[4]);
    const end = vttSeconds(match[5], match[6], match[7], match[8]);

    // Yuvarlanan bicimdeki 10 ms'lik tekrar cue'lari
    if (rolling && end - start < 0.05) continue;

    const body = lines
      .slice(timingIndex + 1)
      .map(cleanCueLine)
      .filter(Boolean);

    if (body.length === 0) continue;

    const text = rolling ? body[body.length - 1] : body.join(" ");
    if (!text) continue;

    // Ayni metin ust uste gelirse tek segmentte birlestirilir
    const previous = segments[segments.length - 1];
    if (previous && previous.text === text) {
      previous.end = end;
      continue;
    }

    segments.push({ start, end, text });
  }

  return segments;
}

/**
 * Verilen ana denk gelen cue'yu bulur.
 *
 * Segmentler zamana gore sirali oldugu icin ikili arama yapiyor: oynatici
 * saniyede birkac kez soruyor ve uzun videolarda liste binlerce satir olabiliyor.
 */
export function cueAt(segments: Segment[], time: number): Segment | null {
  let low = 0;
  let high = segments.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = segments[mid];

    if (time < segment.start) high = mid - 1;
    else if (time >= segment.end) low = mid + 1;
    else return segment;
  }

  return null;
}
