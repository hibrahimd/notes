"use client";

import { useEffect, useState } from "react";

/**
 * Altyazi katmani ve ayarlari — hem gomulu YouTube oynaticisi hem de sunucuda
 * duran videolarin oynaticisi kullanir.
 *
 * Altyazi neden <track> ile degil de elle ciziliyor: ::cue yalnizca renk ve
 * yazi tipi gibi birkac ozelligi kabul ediyor, konum ve kenar boslugu
 * ayarlanamiyor. iOS Safari'de kisit daha da sert ve altyazi karenin en
 * dibine sifir bosluklu yapisiyordu. Kendimiz cizince konum, boyut ve bosluk
 * bize kaliyor.
 */

export type SubtitlePosition = "bottom" | "middle" | "top";
export type SubtitleSize = "small" | "normal" | "large";

export interface SubtitlePrefs {
  position: SubtitlePosition;
  size: SubtitleSize;
}

export const DEFAULT_SUBTITLE_PREFS: SubtitlePrefs = {
  position: "bottom",
  size: "normal",
};

/**
 * Tercihler kullanici ayarlarinda tutulur, tarayicida degil: telefonda
 * yapilan ayar masaustunde de gecerli olsun.
 *
 * Baslangic degeri sunucudan prop olarak geliyor; degisiklik once ekrana
 * yansiyor, kayit arka planda gidiyor. Basarisiz olursa ekrandaki secim
 * bozulmuyor — bir sonraki yuklemede eski deger geri geliyor, o kadar.
 */
export function useSubtitlePrefs(
  initial: SubtitlePrefs
): [SubtitlePrefs, (next: Partial<SubtitlePrefs>) => void] {
  const [prefs, setPrefs] = useState<SubtitlePrefs>(initial);

  const update = (next: Partial<SubtitlePrefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);

    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtitlePosition: merged.position,
        subtitleSize: merged.size,
      }),
    }).catch(() => {
      // Aginda sorun varsa secim bu oturumda gecerli kalir
    });
  };

  return [prefs, update];
}

// Alt konumda kontrol cubugunun uzerinde duruyor; oynaticinin kendi
// kontrolleri yaklasik 40-48 px yer kapliyor
const POSITION_CLASS: Record<SubtitlePosition, string> = {
  bottom: "bottom-14 sm:bottom-16",
  middle: "top-1/2 -translate-y-1/2",
  top: "top-4",
};

const SIZE_CLASS: Record<SubtitleSize, string> = {
  small: "text-xs sm:text-sm px-3 py-1.5",
  normal: "text-sm sm:text-base px-4 py-2",
  large: "text-base sm:text-xl px-5 py-2.5",
};

interface OverlayProps {
  text: string;
  prefs: SubtitlePrefs;
}

export function SubtitleOverlay({ text, prefs }: OverlayProps) {
  if (!text) return null;

  return (
    // pointer-events-none sart: altyazi kutusu oynaticinin dokunma alanini
    // yutmamali
    <div
      className={`absolute inset-x-0 flex justify-center px-4 pointer-events-none ${POSITION_CLASS[prefs.position]}`}
    >
      <span
        className={`max-w-[92%] sm:max-w-3xl text-center text-white leading-relaxed bg-black/80 rounded-lg shadow-lg ${SIZE_CLASS[prefs.size]}`}
      >
        {text}
      </span>
    </div>
  );
}

export interface SubtitleTrack {
  id: string;
  label: string;
  url: string;
}

interface ControlsProps {
  tracks: SubtitleTrack[];
  activeTrackId: string | null;
  onTrackChange: (id: string | null) => void;
  prefs: SubtitlePrefs;
  onPrefsChange: (next: Partial<SubtitlePrefs>) => void;
}

const chipClass = (active: boolean) =>
  `px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
    active
      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
  }`;

const POSITION_LABELS: [SubtitlePosition, string][] = [
  ["bottom", "Alt"],
  ["middle", "Orta"],
  ["top", "Üst"],
];

const SIZE_LABELS: [SubtitleSize, string][] = [
  ["small", "Küçük"],
  ["normal", "Normal"],
  ["large", "Büyük"],
];

export function SubtitleControls({
  tracks,
  activeTrackId,
  onTrackChange,
  prefs,
  onPrefsChange,
}: ControlsProps) {
  return (
    <div className="mt-2 space-y-2">
      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400 w-14 shrink-0">Altyazı</span>
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => onTrackChange(track.id)}
              className={chipClass(activeTrackId === track.id)}
            >
              {track.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onTrackChange(null)}
            className={chipClass(activeTrackId === null)}
          >
            Kapalı
          </button>
        </div>
      )}

      {/* Konum ve boyut yalnizca altyazi acikken anlamli */}
      {activeTrackId && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400 w-14 shrink-0">Konum</span>
            {POSITION_LABELS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onPrefsChange({ position: value })}
                className={chipClass(prefs.position === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400 w-14 shrink-0">Boyut</span>
            {SIZE_LABELS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onPrefsChange({ size: value })}
                className={chipClass(prefs.size === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Secili altyazi parcasini indirip cozer.
 *
 * Bagimlilik dizinin kendisi degil adresi: ust bilesen her tazelendiginde
 * yeni dizi uretiyor ve altyazi bosuna yeniden indiriliyordu.
 */
export function useSubtitleSegments(url: string | null) {
  const [segments, setSegments] = useState<
    { start: number; end: number; text: string }[]
  >([]);

  useEffect(() => {
    if (!url) {
      setSegments([]);
      return;
    }

    let cancelled = false;

    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("altyazı okunamadı"))))
      .then(async (text) => {
        const { parseVtt } = await import("@/lib/vtt");
        if (!cancelled) setSegments(parseVtt(text));
      })
      .catch(() => {
        if (!cancelled) setSegments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return segments;
}
