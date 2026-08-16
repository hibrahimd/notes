"use client";

import { useEffect, useRef, useState } from "react";
import { cueAt, type Segment } from "@/lib/vtt";
import {
  SubtitleOverlay,
  SubtitleControls,
  useSubtitlePrefs,
  useSubtitleSegments,
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

export function YouTubePlayer({ videoId, tracks }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);

  const [activeTrackId, setActiveTrackId] = useState<string | null>(
    tracks[0]?.id ?? null
  );
  const [cue, setCue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useSubtitlePrefs();

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


  if (error) {
    return (
      <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <p className="text-sm text-zinc-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
        {/* Oynatici bu kabin icine imperatif olarak ekleniyor */}
        <div ref={mountRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />

        {activeTrackId && <SubtitleOverlay text={cue} prefs={prefs} />}
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
