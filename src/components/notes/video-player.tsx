"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildVtt, cueAt } from "@/lib/vtt";
import {
  SubtitleOverlay,
  SubtitleControls,
  POSITION_CUE_SETTINGS,
  useSubtitlePrefs,
  useSubtitleSegments,
  type SubtitlePrefs,
  type SubtitleTrack,
} from "./subtitles";

/**
 * Sunucuda duran videolar icin oynatici.
 *
 * Altyazi normalde elle ciziliyor (sebebi subtitles.tsx icinde). Tam ekranda
 * ise durum tersine donuyor: tam ekrana geciyor olan <video> ogesinin kendisi
 * ve bizim katmanimiz onun disinda kaldigi icin gorunmuyor. iPhone'da video
 * sistem oynaticisina devrediyor, oraya hicbir sey bindirilemiyor.
 *
 * Bu yuzden altyazi ayrica <track> olarak da veriliyor ama kipi "hidden"
 * tutuluyor; yalnizca tam ekranda "showing" yapiliyor. Boylece pencere icinde
 * bizim gorunumumuz, tam ekranda oynaticinin kendi cizimi kullaniliyor.
 *
 * Tam ekrandaki parca sunucudaki dosya degil, secilen konuma gore tarayicida
 * uretilen bir kopya: WebVTT cue ayarlari ("line:50%") sistem oynaticisinda
 * da gecerli oldugu icin konum tercihi tam ekranda da korunuyor.
 */

interface Props {
  src: string;
  mimeType: string | null;
  poster: string | null;
  tracks: SubtitleTrack[];
  initialPrefs: SubtitlePrefs;
}

export function VideoPlayer({
  src,
  mimeType,
  poster,
  tracks,
  initialPrefs,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(
    tracks[0]?.id ?? null
  );
  const [cue, setCue] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [prefs, setPrefs] = useSubtitlePrefs(initialPrefs);

  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;
  const segments = useSubtitleSegments(activeTrack?.url ?? null);

  // Tam ekran parcasi konum tercihi gomulu halde yeniden uretiliyor
  const [fullscreenTrackUrl, setFullscreenTrackUrl] = useState<string | null>(null);
  const vttText = useMemo(
    () =>
      segments.length
        ? buildVtt(segments, POSITION_CUE_SETTINGS[prefs.position])
        : null,
    [segments, prefs.position]
  );

  useEffect(() => {
    if (!vttText) {
      setFullscreenTrackUrl(null);
      return;
    }

    const url = URL.createObjectURL(new Blob([vttText], { type: "text/vtt" }));
    setFullscreenTrackUrl(url);

    // Blob adresleri sekme kapanana kadar bellekte kalir, elle birakiliyor
    return () => URL.revokeObjectURL(url);
  }, [vttText]);

  // Tam ekrana giris/cikis. iOS video icin standart fullscreenchange
  // tetiklemiyor, kendi webkit olaylarini kullaniyor.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const enter = () => setFullscreen(true);
    const exit = () => setFullscreen(false);
    const change = () => setFullscreen(document.fullscreenElement !== null);

    video.addEventListener("webkitbeginfullscreen", enter);
    video.addEventListener("webkitendfullscreen", exit);
    document.addEventListener("fullscreenchange", change);

    return () => {
      video.removeEventListener("webkitbeginfullscreen", enter);
      video.removeEventListener("webkitendfullscreen", exit);
      document.removeEventListener("fullscreenchange", change);
    };
  }, []);

  // Yerlesik altyazi yalnizca tam ekranda gorunur
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const mode = fullscreen && activeTrack ? "showing" : "hidden";
    for (const track of Array.from(video.textTracks)) {
      track.mode = mode;
    }
  }, [fullscreen, activeTrack, fullscreenTrackUrl]);

  return (
    // Dis bosluk cagirana ait: bu bilesenin altinda dosya bilgisi satiri var
    <>
      <div className="relative w-full rounded-xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          poster={poster || undefined}
          className="w-full block"
          // timeupdate saniyede dort kez tetikleniyor, altyazi icin yeterli
          onTimeUpdate={() => {
            const time = videoRef.current?.currentTime ?? 0;
            setCue(cueAt(segments, time)?.text ?? "");
          }}
        >
          <source src={src} type={mimeType || "video/mp4"} />
          {activeTrack && fullscreenTrackUrl && (
            // key: parca degisince ogenin yeniden kurulmasi gerekiyor,
            // src degisimi tek basina yeni altyaziyi yuklemiyor
            <track
              key={fullscreenTrackUrl}
              kind="subtitles"
              src={fullscreenTrackUrl}
              label={activeTrack.label}
              default
            />
          )}
        </video>

        {activeTrack && !fullscreen && (
          <SubtitleOverlay text={cue} prefs={prefs} />
        )}
      </div>

      <SubtitleControls
        tracks={tracks}
        activeTrackId={activeTrackId}
        onTrackChange={setActiveTrackId}
        prefs={prefs}
        onPrefsChange={setPrefs}
      />
    </>
  );
}
