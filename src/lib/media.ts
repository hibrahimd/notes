import { spawn } from "child_process";
import { mkdir, readdir, readFile, stat } from "fs/promises";
import path from "path";
import { parseVtt, type Segment } from "./vtt";

// VTT okuma/yazma tarayicida da gerekiyor, o yuzden ayri dosyada duruyor
export { parseVtt, buildVtt, cueAt, type Segment } from "./vtt";

/**
 * yt-dlp ve ffmpeg sarmalayicilari. Yalnizca worker tarafinda kullanilir.
 */

const YT_DLP = process.env.YTDLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}

interface RunResult {
  stdout: string;
  stderr: string;
}

function run(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    // Hata mesajlari cok uzayabiliyor; son kismi yeterli
    const cap = (current: string, chunk: string) =>
      (current + chunk).slice(-20000);

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new MediaError(`${command} zaman aşımına uğradı`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout = cap(stdout, String(d))));
    child.stderr.on("data", (d) => (stderr = cap(stderr, String(d))));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new MediaError(`${command} çalıştırılamadı: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new MediaError(lastMeaningfulLine(stderr) || `${command} ${code} koduyla çıktı`));
    });
  });
}

/** yt-dlp hatalarinda kullaniciya gosterilecek son anlamli satiri secer. */
function lastMeaningfulLine(stderr: string): string | null {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("WARNING:"));
  const errorLine = [...lines].reverse().find((l) => l.startsWith("ERROR:"));
  return (errorLine || lines[lines.length - 1] || "").slice(0, 400) || null;
}

const VIDEO_HOSTS = [
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "instagram.com",
  "vimeo.com",
  "tiktok.com",
];

/** URL, video barindirdigi bilinen bir siteye mi ait. */
export function looksLikeVideoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export interface VideoInfo {
  id: string;
  title: string | null;
  durationSeconds: number | null;
  thumbnail: string | null;
  extractor: string | null;
  /** Videonun konusuldugu dil (yt-dlp bildiriyorsa) */
  language: string | null;
  /** Insan yazimi altyazi dilleri */
  subtitleLanguages: string[];
  /** Otomatik uretilmis altyazi dilleri */
  autoCaptionLanguages: string[];
}

function languageKeys(value: unknown): string[] {
  return value && typeof value === "object" ? Object.keys(value) : [];
}

/** Videoyu indirmeden once meta verisini alir. */
export async function probeVideo(url: string): Promise<VideoInfo> {
  const { stdout } = await run(
    YT_DLP,
    ["--no-warnings", "--no-playlist", "--dump-single-json", url],
    120000
  );

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new MediaError("Video bilgisi çözümlenemedi");
  }

  const duration = Number(data.duration);

  return {
    id: String(data.id ?? ""),
    title: typeof data.title === "string" ? data.title : null,
    durationSeconds: Number.isFinite(duration) ? Math.round(duration) : null,
    thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : null,
    extractor: typeof data.extractor === "string" ? data.extractor : null,
    language: typeof data.language === "string" ? data.language : null,
    subtitleLanguages: languageKeys(data.subtitles),
    autoCaptionLanguages: languageKeys(data.automatic_captions),
  };
}

export interface CaptionChoice {
  lang: string;
  /** true ise insan yazimi altyazi, false ise otomatik uretim */
  manual: boolean;
}

/**
 * Kaynak dildeki altyaziyi secer.
 *
 * YouTube otomatik altyazilari hedef dile kendi cevirisiyle de sunuyor
 * ("tr-en" = ingilizceden turkceye) ama o uc nokta sunucu IP'lerine 429
 * donduruyor ve cevirisi bizim hattimizdan zayif. Bu yuzden yalnizca kaynak
 * dildeki altyaziyi aliyoruz; ceviriyi secilen AI saglayicisi yapiyor.
 */
export function pickCaptionLanguage(info: VideoInfo): CaptionChoice | null {
  const original = info.language?.toLowerCase() || null;

  const exact = (langs: string[]) =>
    original ? langs.find((l) => l.toLowerCase() === original) : undefined;

  // Insan yazimi altyazi her zaman tercih edilir
  const manual =
    exact(info.subtitleLanguages) ||
    (original
      ? info.subtitleLanguages.find((l) =>
          l.toLowerCase().startsWith(`${original}-`)
        )
      : info.subtitleLanguages.find((l) => !l.includes("-"))) ||
    (!original ? info.subtitleLanguages[0] : undefined);

  if (manual) return { lang: manual, manual: true };

  // Otomatik altyazilarda tireli anahtarlar ceviri varyantlaridir
  const auto =
    exact(info.autoCaptionLanguages) ||
    info.autoCaptionLanguages.find((l) => !l.includes("-"));

  return auto ? { lang: auto, manual: false } : null;
}

/**
 * Altyaziyi videoyu indirmeden ceker.
 *
 * YouTube sunucu IP'lerinden medya akisini 403 ile kapatiyor ama altyazi
 * uc noktasi acik. Altyazi varsa video indirmeye de konusma tanimaya da
 * gerek kalmiyor; hem cok daha hizli hem de bedava.
 *
 * Basarisiz olursa hata firlatmaz: cagiran taraf konusma tanimaya duser.
 */
export async function fetchCaptions(
  url: string,
  targetDir: string,
  choice: CaptionChoice
): Promise<{ filePath: string; segments: Segment[] } | null> {
  await mkdir(targetDir, { recursive: true });

  const base = path.join(targetDir, "captions");

  try {
    await run(
      YT_DLP,
      [
        "--no-warnings",
        "--no-playlist",
        "--skip-download",
        choice.manual ? "--write-subs" : "--write-auto-subs",
        "--sub-langs",
        choice.lang,
        "--sub-format",
        "vtt",
        "-o",
        base,
        url,
      ],
      180000
    );
  } catch (error) {
    console.warn(
      `[media] Altyazı indirilemedi (${choice.lang}):`,
      error instanceof Error ? error.message : error
    );
    return null;
  }

  const files = await readdir(targetDir);
  const file = files.find((f) => f.startsWith("captions.") && f.endsWith(".vtt"));
  if (!file) return null;

  const filePath = path.join(targetDir, file);
  const segments = parseVtt(await readFile(filePath, "utf-8"));

  return segments.length > 0 ? { filePath, segments } : null;
}

export interface DownloadedVideo {
  filePath: string;
  sizeBytes: number;
}

/**
 * Videoyu indirir. 720p ile sinirlanir: altyazi icin daha yuksek cozunurluk
 * bir sey katmiyor ama dosya boyutunu katliyor.
 */
export async function downloadVideo(
  url: string,
  targetDir: string
): Promise<DownloadedVideo> {
  await mkdir(targetDir, { recursive: true });

  const output = path.join(targetDir, "video.%(ext)s");

  await run(
    YT_DLP,
    [
      "--no-warnings",
      "--no-playlist",
      "--no-part",
      "--retries",
      "3",
      "-f",
      "bv*[height<=720]+ba/b[height<=720]/b",
      "--merge-output-format",
      "mp4",
      "-o",
      output,
      url,
    ],
    900000
  );

  const files = await readdir(targetDir);
  const video = files.find((f) => f.startsWith("video."));
  if (!video) throw new MediaError("İndirilen video dosyası bulunamadı");

  const filePath = path.join(targetDir, video);
  const info = await stat(filePath);

  return { filePath, sizeBytes: info.size };
}

/**
 * Konusma tanima icin ses cikarir: 16 kHz mono, 48 kbps mp3.
 * Bu ayarla bir saatlik ses ~22 MB kaliyor ve tek istekte gonderilebiliyor.
 */
export async function extractAudio(
  videoPath: string,
  targetDir: string
): Promise<{ filePath: string; sizeBytes: number }> {
  const filePath = path.join(targetDir, "audio.mp3");

  await run(
    FFMPEG,
    [
      "-y",
      "-i",
      videoPath,
      // Birden fazla ses akisi varsa ilkini (varsayilani) al; belirtilmezse
      // ffmpeg'in secimi dosyaya gore degisebiliyor
      "-map",
      "0:a:0",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "48k",
      filePath,
    ],
    900000
  );

  const info = await stat(filePath);
  return { filePath, sizeBytes: info.size };
}

