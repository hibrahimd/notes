"use client";

import { useRef, useState } from "react";
import { cueAt } from "@/lib/vtt";
import {
  SubtitleOverlay,
  SubtitleControls,
  useSubtitlePrefs,
  useSubtitleSegments,
  type SubtitleTrack,
} from "./subtitles";

/**
 * Sunucuda duran videolar icin oynatici.
 *
 * Altyazi <track> ile degil elle ciziliyor; sebebi ve karsiligi subtitles.tsx
 * icinde anlatiliyor. Gomulu YouTube oynaticisi da ayni katmani kullaniyor,
 * boylece iki oynaticida altyazi ayni gorunuyor ve ayni ayarlari paylasiyor.
 */

interface Props {
  src: string;
  mimeType: string | null;
  poster: string | null;
  tracks: SubtitleTrack[];
}

export function VideoPlayer({ src, mimeType, poster, tracks }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(
    tracks[0]?.id ?? null
  );
  const [cue, setCue] = useState("");
  const [prefs, setPrefs] = useSubtitlePrefs();

  const activeTrackUrl = tracks.find((t) => t.id === activeTrackId)?.url ?? null;
  const segments = useSubtitleSegments(activeTrackUrl);

  // Dis bosluk cagirana ait: bu bilesenin altinda dosya bilgisi satiri var
  return (
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
        </video>

        {activeTrackId && <SubtitleOverlay text={cue} prefs={prefs} />}
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
