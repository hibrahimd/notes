import { spawn } from "child_process";
import { mkdir, readdir, stat } from "fs/promises";
import path from "path";

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

export interface VideoInfo {
  id: string;
  title: string | null;
  durationSeconds: number | null;
  thumbnail: string | null;
  extractor: string | null;
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
  };
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
