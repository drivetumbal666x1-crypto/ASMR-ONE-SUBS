"use client";

import { VttCue } from "@/lib/asmr-api";
import { useState, useEffect, useRef } from "react";
import { Languages, Loader2 } from "lucide-react";

interface SubtitleDisplayProps {
  cues: VttCue[];
  currentTime: number;
  onTranslate?: (cueIndex: number, text: string) => void;
  translatingIndex?: number | null;
  mode?: "panel" | "floating";
  englishOnly?: boolean; // when true, show only the English translation
}

// Simple in-browser translation cache
const translationCache = new Map<string, string>();

async function translateText(text: string): Promise<string> {
  const cached = translationCache.get(text);
  if (cached) return cached;

  try {
    // Use a free translation API (Google Translate unofficial)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    const translated = data?.[0]?.map((s: unknown[]) => s?.[0]).join("") || text;
    translationCache.set(text, translated);
    return translated;
  } catch {
    return text;
  }
}

export default function SubtitleDisplay({
  cues,
  currentTime,
  mode = "panel",
  englishOnly = false,
}: SubtitleDisplayProps) {
  const [translatedCues, setTranslatedCues] = useState<Map<number, string>>(new Map());
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [prefetching, setPrefetching] = useState(false);
  const [prefetchDone, setPrefetchDone] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find active cue
  const activeIndex = cues.findIndex(
    (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
  );

  // Pre-translate the ENTIRE subtitle track in the background as soon as the
  // cues load, so English is ready before/while playing (English-only mode).
  useEffect(() => {
    if (!autoTranslate || cues.length === 0) return;

    let cancelled = false;
    setPrefetchDone(0);
    setPrefetching(true);

    // Seed cues that already have Whisper translations
    const seeded = new Map<number, string>();
    cues.forEach((cue, idx) => {
      if (cue.translatedText) seeded.set(idx, cue.translatedText);
    });
    if (seeded.size > 0) {
      setTranslatedCues((prev) => new Map([...prev, ...seeded]));
    }

    async function prefetchAll() {
      const concurrency = 5;
      let index = 0;
      let completed = 0;

      async function worker() {
        while (index < cues.length && !cancelled) {
          const i = index++;
          const cue = cues[i];
          // Skip if already translated (Whisper-provided or cached)
          if (cue.translatedText) {
            completed++;
            continue;
          }
          const translated = await translateText(cue.text);
          if (cancelled) return;
          setTranslatedCues((prev) => {
            const next = new Map(prev);
            next.set(i, translated);
            return next;
          });
          completed++;
          setPrefetchDone(completed);
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, cues.length) }, () => worker())
      );

      if (!cancelled) setPrefetching(false);
    }

    prefetchAll();

    return () => {
      cancelled = true;
    };
  }, [cues, autoTranslate]);

  // Fallback: ensure the current cue is translated ASAP (in case prefetch
  // hasn't reached it yet), so the active line is never blank.
  useEffect(() => {
    if (!autoTranslate || activeIndex < 0) return;
    const cue = cues[activeIndex];
    if (!cue || translatedCues.has(activeIndex)) return;
    if (cue.translatedText) {
      setTranslatedCues((prev) => {
        const next = new Map(prev);
        next.set(activeIndex, cue.translatedText!);
        return next;
      });
      return;
    }

    let cancelled = false;
    setTranslatingIndex(activeIndex);

    translateText(cue.text).then((translated) => {
      if (!cancelled) {
        setTranslatedCues((prev) => {
          const next = new Map(prev);
          next.set(activeIndex, translated);
          return next;
        });
        setTranslatingIndex(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeIndex, autoTranslate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to active cue
  useEffect(() => {
    if (containerRef.current && activeIndex >= 0) {
      const activeEl = containerRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeIndex]);

  if (cues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        <div className="text-center">
          <Languages className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No subtitles available</p>
          <p className="text-xs mt-1">
            {autoTranslate
              ? "Live transcription will appear here"
              : "Enable auto-translate to see subtitles"}
          </p>
        </div>
      </div>
    );
  }

  // Show current cue and nearby cues
  const startIdx = Math.max(0, activeIndex - 1);
  const endIdx = Math.min(cues.length, activeIndex + 4);
  const visibleCues = cues.slice(startIdx, endIdx);

  // Floating single-cue mode for the expanded "Now Playing" screen
  if (mode === "floating") {
    const activeCue = activeIndex >= 0 ? cues[activeIndex] : null;
    const translated = activeIndex >= 0 ? translatedCues.get(activeIndex) : undefined;
    const isTranslating = translatingIndex === activeIndex;
    const displayEnglishOnly = englishOnly && autoTranslate;

    if (!activeCue) {
      return (
        <div className="text-center text-white/35 text-sm py-3 min-h-[64px] flex items-center justify-center">
          {prefetching
            ? `Preparing English subtitles… ${prefetchDone}/${cues.length}`
            : "Play audio to see subtitles"}
        </div>
      );
    }

    // English-only: show just the translated line (fall back to original only
    // if translation isn't ready yet for the current line).
    if (displayEnglishOnly) {
      return (
        <div className="w-full px-2 min-h-[64px] flex items-center justify-center">
          <div className="max-w-full rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 px-5 py-3 shadow-lg">
            {translated ? (
              <p className="text-white text-base sm:text-lg font-semibold leading-snug text-center break-words">
                {translated}
              </p>
            ) : (
              <p className="text-white/60 text-sm italic flex items-center justify-center gap-1.5 leading-snug text-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Translating…
              </p>
            )}
          </div>
        </div>
      );
    }

    // Default floating: original + translation
    return (
      <div className="w-full px-2 min-h-[64px] flex items-center justify-center">
        <div className="max-w-full rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 px-5 py-3 shadow-lg">
          <p className="text-white text-base sm:text-lg font-semibold leading-snug text-center break-words">
            {activeCue.text}
          </p>
          {translated && (
            <p className="text-pink-200 text-sm sm:text-base mt-1.5 leading-snug text-center break-words">
              {translated}
            </p>
          )}
          {isTranslating && !translated && (
            <p className="text-xs mt-1.5 text-white/50 italic flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Translating...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 flex-shrink-0">
        <span className="text-xs text-slate-400 font-medium">
          {cues.length} subtitles
          {prefetching && (
            <span className="ml-2 text-pink-400/80">
              · translating {prefetchDone}/{cues.length}
            </span>
          )}
        </span>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
            className="w-3 h-3 rounded border-slate-500 text-pink-500 focus:ring-pink-400"
          />
          <span className="text-slate-400">Auto EN</span>
          {(translatingIndex !== null || prefetching) && (
            <Loader2 className="w-3 h-3 animate-spin text-pink-400" />
          )}
        </label>
      </div>

      {/* Cues */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {visibleCues.map((cue, i) => {
          const globalIndex = startIdx + i;
          const isActive = globalIndex === activeIndex;
          const translated = translatedCues.get(globalIndex);
          const isTranslating = translatingIndex === globalIndex;

          const showEnglishOnly = englishOnly && autoTranslate;

          return (
            <div
              key={globalIndex}
              data-index={globalIndex}
              className={`p-2 rounded-lg transition-all duration-300 ${
                isActive
                  ? "bg-pink-500/20 border border-pink-500/40 scale-[1.02]"
                  : "border border-transparent hover:bg-slate-800/30"
              }`}
            >
              {showEnglishOnly ? (
                translated ? (
                  <p
                    className={`text-sm leading-relaxed ${
                      isActive ? "text-white font-medium" : "text-slate-300"
                    }`}
                  >
                    {translated}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Translating...
                  </p>
                )
              ) : (
                <>
                  <p
                    className={`text-sm leading-relaxed ${
                      isActive ? "text-white font-medium" : "text-slate-300"
                    }`}
                  >
                    {cue.text}
                  </p>
                  {translated && (
                    <p
                      className={`text-xs mt-1 leading-relaxed ${
                        isActive ? "text-pink-200" : "text-pink-400/70"
                      }`}
                    >
                      {translated}
                    </p>
                  )}
                  {isTranslating && !translated && (
                    <p className="text-xs mt-1 text-slate-500 italic flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Translating...
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}

        {activeIndex < 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            Play audio to see subtitles
          </div>
        )}
      </div>
    </div>
  );
}
