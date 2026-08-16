"use client";

import { useEffect, useRef, useState } from "react";
import { cueAt, type Segment } from "@/lib/vtt";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  SubtitleOverlay,
  SubtitleControls,
  useSubtitlePrefs,
  useSubtitleSegments,
  type SubtitlePrefs,
  type SubtitleTrack,
} from "./subtitles";

/**
 * YouTube videolarini kendi altyazimizla oynatir.
 *
 * YouTube sunucu IP'lerinden medya akisini 403 ile kapatiyor, yani videoyu
 * indirip <video> etiketiyle sunamiyoruz. Bunun yerine YouTube oynaticisini
 * gomup altyaziyi ustune biniyoruz: cue'lar oynaticinin kendi zamanindan
 * okunuyor. YouTube'un kendi ceviri altyazisi da var ama sunucudan 429
 * donuyor ve kalitesi bizim ceviri hattimizin altinda.
 */

interface Props {
  videoId: string;
  tracks: SubtitleTrack[];
  initialPrefs: SubtitlePrefs;
}

interface YouTubePlayer {
  getCurrentTime(): number;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
let apiPromise: Promise<YouTubeApi> | null = null;

/**
 * IFrame API'sini bir kez yukler.
 *
 * onYouTubeIframeAPIReady global ve tek: her bilesen kendi betigini
 * eklerse birbirlerinin geri cagrisini eziyorlar.
 */
function loadYouTubeApi(): Promise<YouTubeApi> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      if (window.YT) resolve(window.YT);
      else reject(new Error("YouTube API yüklendi ama YT tanımlı değil"));
    };

    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => reject(new Error("YouTube oynatıcısı yüklenemedi"));
    document.head.appendChild(script);
  });

  return apiPromise;
}

export function YouTubePlayer({ videoId, tracks, initialPrefs }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);

  const [activeTrackId, setActiveTrackId] = useState<string | null>(
    tracks[0]?.id ?? null
  );
  const [cue, setCue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useSubtitlePrefs(initialPrefs);

  const activeTrackUrl = tracks.find((t) => t.id === activeTrackId)?.url ?? null;
  const segments = useSubtitleSegments(activeTrackUrl);

  // Zamanlayici surekli calisiyor, bagimliliklari yenilemek yerine son
  // segmentleri ref uzerinden okuyor
  const segmentsRef = useRef<Segment[]>([]);
  segmentsRef.current = segments;

  // Oynatici bir kez kurulur; altyazi degisimi yeniden kurmayi gerektirmiyor
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;

        // YT baglandigi ogeyi iframe ile degistiriyor. React'in yonettigi
        // dugumu verirsek unmount sirasinda kaldirmaya calistigi dugum
        // ortadan kalkmis oluyor; bu yuzden kendi dugumumuzu ekliyoruz.
        const host = document.createElement("div");
        mountRef.current.appendChild(host);

        playerRef.current = new YT.Player(host, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            // YouTube'un kendi altyazisi kapali: kendi parcamizi bindiriyoruz
            cc_load_policy: 0,
            // YouTube'un kendi tam ekran dugmesi kapali: iframe tam ekrana
            // gecince altyazi katmanimiz disarida kaliyor. Yerine kendi
            // genis gorunumumuz var.
            fs: 0,
            origin: window.location.origin,
          },
        });

        // Altyazi icin saniyede bes kez sormak yeterli; cue'lar saniyelerce
        // ekranda kaliyor
        timer = setInterval(() => {
          const player = playerRef.current;
          if (!player?.getCurrentTime) return;

          const found = cueAt(segmentsRef.current, player.getCurrentTime());
          setCue(found?.text ?? "");
        }, 200);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      playerRef.current?.destroy?.();
      playerRef.current = null;
      // React bu dugumleri tanimiyor, elle temizleniyor
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, [videoId]);

  // Genis gorunum CSS ile yapiliyor, Fullscreen API ile degil: iPhone'da
  // <video> disindaki ogeler tam ekrana alinamiyor ve API sessizce
  // reddediyor. Sabit konumlu kap her platformda calisiyor.
  useEffect(() => {
    if (!expanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  if (error) {
    return (
      <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <p className="text-sm text-zinc-500">{error}</p>
      </div>
    );
  }

  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-50 bg-black flex flex-col justify-center p-3 sm:p-6"
          : "mb-6"
      }
    >
      {/* max-w: 16:9 korunurken yukseklik ekranin %70'ini gecmesin.
          Genis ekranlarda oynatici sayfayi yutuyordu. */}
      <div
        className={`relative w-full aspect-video bg-black mx-auto max-h-[70vh] max-w-[calc(70vh*16/9)] ${expanded ? "" : "rounded-xl overflow-hidden"}`}
      >
        {/* Oynatici bu kabin icine imperatif olarak ekleniyor */}
        <div ref={mountRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />

        {activeTrackId && <SubtitleOverlay text={cue} prefs={prefs} />}

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Geniş görünümden çık" : "Geniş görünüm"}
          className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 cursor-pointer"
        >
          {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      <SubtitleControls
        tracks={tracks}
        activeTrackId={activeTrackId}
        onTrackChange={setActiveTrackId}
        prefs={prefs}
        onPrefsChange={setPrefs}
      />

      <p className="text-xs text-zinc-400 mt-2">
        Video YouTube üzerinden oynatılıyor, altyazı Not Al&apos;ın kendi
        çevirisidir.
      </p>
    </div>
  );
}
