"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { VttCue, parseVtt, ImageItem } from "@/lib/asmr-api";
import SubtitleDisplay from "./SubtitleDisplay";
import WhisperGenerator from "./WhisperGenerator";
import TranslatedText from "./TranslatedText";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Subtitles,
  SubtitlesIcon as SubtitlesOff,
  X,
  ImageIcon,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  audioTitle: string;
  workTitle: string;
  coverUrl: string;
  subtitleUrl: string | null;
  images?: ImageItem[];
  onClose: () => void;
  onTrackChange: (direction: "prev" | "next") => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  audioUrl,
  audioTitle,
  workTitle,
  coverUrl,
  subtitleUrl,
  images = [],
  onClose,
  onTrackChange,
  hasPrev,
  hasNext,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [cues, setCues] = useState<VttCue[]>([]);
  const [whisperCues, setWhisperCues] = useState<VttCue[]>([]);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Image slideshow state (shared between mini bar + full "Now Playing" view)
  const allImages = images.length > 0 ? images.map((i) => i.url) : coverUrl ? [coverUrl] : [];
  const [imgIndex, setImgIndex] = useState(0);
  const [showImagePanel, setShowImagePanel] = useState(true);

  // Auto-cycle images every 8 seconds while playing
  useEffect(() => {
    if (!playing || allImages.length <= 1) return;
    const interval = setInterval(() => {
      setImgIndex((i) => (i + 1) % allImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [playing, allImages.length]);

  // Reset image index when the track (and its image set) changes
  useEffect(() => {
    setImgIndex(0);
  }, [audioUrl]);

  // Load VTT subtitles
  useEffect(() => {
    setWhisperCues([]); // reset whisper on track change
    if (!subtitleUrl) {
      setCues([]);
      return;
    }

    setLoading(true);
    fetch(`/api/vtt?url=${encodeURIComponent(subtitleUrl)}`)
      .then((res) => res.text())
      .then((text) => {
        const parsed = parseVtt(text);
        setCues(parsed);
      })
      .catch(() => setCues([]))
      .finally(() => setLoading(false));
  }, [subtitleUrl, audioUrl]);

  // Combine VTT + Whisper cues (Whisper takes precedence when no VTT)
  const activeCues = cues.length > 0 ? cues : whisperCues;

  // Reset player on new audio
  useEffect(() => {
    setCurrentTime(0);
    setPlaying(false);
    setDuration(0);

    const audio = audioRef.current;
    if (!audio) return;

    audio.load();

    const onLoaded = () => {
      setDuration(audio.duration || 0);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    return () => audio.removeEventListener("loadedmetadata", onLoaded);
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setPlaying(!playing);
  }, [playing]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = v;
      audio.muted = v === 0;
    }
    setVolume(v);
    setMuted(v === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      audio.muted = false;
      audio.volume = volume || 1;
      setMuted(false);
      if (volume === 0) setVolume(1);
    } else {
      audio.muted = true;
      setMuted(true);
    }
  }, [muted, volume]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    if (hasNext) onTrackChange("next");
  }, [hasNext, onTrackChange]);

  const goPrevImage = useCallback(() => {
    setImgIndex((i) => (i - 1 + allImages.length) % allImages.length);
  }, [allImages.length]);

  const goNextImage = useCallback(() => {
    setImgIndex((i) => (i + 1) % allImages.length);
  }, [allImages.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === "ArrowLeft" && !expanded) {
        const audio = audioRef.current;
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10);
      }
      if (e.code === "ArrowRight" && !expanded) {
        const audio = audioRef.current;
        if (audio) audio.currentTime = Math.min(duration, audio.currentTime + 10);
      }
      if (e.code === "Escape" && expanded) {
        setExpanded(false);
      }
    },
    [togglePlay, duration, expanded]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const currentArt = allImages[imgIndex] || coverUrl;

  return (
    <>
      {/* Audio element - shared between mini bar and full view */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="auto"
      />

      {/* ============ FULL-SCREEN "NOW PLAYING" VIEW (Spotify-style) ============ */}
      {expanded && (
        <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden">
          {/* Blurred artwork background */}
          <div className="absolute inset-0">
            <img
              src={currentArt}
              alt=""
              className="w-full h-full object-cover scale-110 blur-3xl opacity-50"
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-slate-950/85 to-black" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 flex-shrink-0">
              <button
                onClick={() => setExpanded(false)}
                className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Minimize"
              >
                <ChevronDown className="w-6 h-6" />
              </button>
              <div className="text-center min-w-0 px-4">
                <p className="text-[10px] uppercase tracking-wider text-white/50">
                  Now Playing
                </p>
                <TranslatedText
                  text={workTitle}
                  className="text-xs text-white/80 truncate block max-w-[50vw] mx-auto"
                />
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Stop and close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable middle area (art + info + subtitles) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8">
              <div className="max-w-md mx-auto flex flex-col items-center pb-4">
                {/* Large artwork slideshow */}
                <div className="relative w-full max-w-[320px] sm:max-w-[380px] aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/50 group flex-shrink-0 mt-2">
                  <img
                    src={currentArt}
                    alt="Artwork"
                    className="w-full h-full object-cover transition-opacity duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />

                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={goPrevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={goNextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 rounded-full text-[10px] text-white font-mono">
                        {imgIndex + 1} / {allImages.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Dot indicators */}
                {allImages.length > 1 && allImages.length <= 12 && (
                  <div className="flex items-center gap-1.5 mt-3">
                    {allImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setImgIndex(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === imgIndex ? "w-4 bg-pink-400" : "w-1.5 bg-white/30 hover:bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Floating subtitle directly under artwork */}
                {showSubtitles && (
                  <div className="w-full mt-4">
                    {loading ? (
                      <div className="text-center text-white/35 text-sm py-3 min-h-[64px] flex items-center justify-center">
                        Loading subtitles...
                      </div>
                    ) : activeCues.length > 0 ? (
                      <SubtitleDisplay
                        cues={activeCues}
                        currentTime={currentTime}
                        mode="floating"
                        englishOnly
                      />
                    ) : (
                      <div className="rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 px-4 py-3 min-h-[64px] flex items-center justify-center">
                        <WhisperGenerator audioUrl={audioUrl} onCuesGenerated={setWhisperCues} />
                      </div>
                    )}
                  </div>
                )}

                {/* Track info */}
                <div className="w-full text-center mt-4">
                  <TranslatedText
                    text={audioTitle}
                    className="text-lg sm:text-xl font-bold text-white block leading-snug"
                  />
                  <TranslatedText
                    text={workTitle}
                    className="text-sm text-white/60 block mt-1 truncate"
                  />
                </div>

                {/* Seek bar */}
                <div className="w-full mt-5">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 accent-pink-500 cursor-pointer"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-white/50 font-mono">
                      {formatTime(currentTime)}
                    </span>
                    <span className="text-[11px] text-white/50 font-mono">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>

                {/* Playback controls */}
                <div className="flex items-center justify-center gap-6 mt-4">
                  <button
                    onClick={() => onTrackChange("prev")}
                    disabled={!hasPrev}
                    className="p-2 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipBack className="w-6 h-6 fill-current" />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="p-4 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform shadow-lg"
                  >
                    {playing ? (
                      <Pause className="w-7 h-7 fill-current" />
                    ) : (
                      <Play className="w-7 h-7 fill-current ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => onTrackChange("next")}
                    disabled={!hasNext}
                    className="p-2 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipForward className="w-6 h-6 fill-current" />
                  </button>
                </div>

                {/* Volume + subtitle toggle */}
                <div className="flex items-center justify-center gap-4 mt-4 w-full">
                  <button
                    onClick={toggleMute}
                    className="p-1.5 text-white/60 hover:text-white transition-colors"
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 accent-pink-500"
                  />

                  <div className="w-px h-4 bg-white/20 mx-1" />

                  <button
                    onClick={() => setShowSubtitles(!showSubtitles)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      showSubtitles
                        ? "bg-pink-500/20 text-pink-300 hover:bg-pink-500/30"
                        : "bg-white/10 text-white/60 hover:bg-white/20"
                    }`}
                  >
                    {showSubtitles ? (
                      <Subtitles className="w-3.5 h-3.5" />
                    ) : (
                      <SubtitlesOff className="w-3.5 h-3.5" />
                    )}
                    Subtitles
                  </button>
                </div>


              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ MINI BAR (collapsed / default) ============ */}
      {!expanded && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-2xl">
          <div className="flex h-[200px]">
            {/* Left: Info + Controls */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Controls row */}
              <div className="flex items-center gap-3 px-4 pt-3">
                {/* Cover small (click to expand) */}
                <button
                  onClick={() => setExpanded(true)}
                  className="flex-shrink-0 group relative"
                  title="Expand"
                >
                  <img
                    src={currentArt}
                    alt={workTitle}
                    className="w-10 h-10 rounded-md object-cover bg-slate-800"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 rounded-md bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ChevronUp className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>

                {/* Track info */}
                <button
                  onClick={() => setExpanded(true)}
                  className="min-w-0 flex-1 text-left"
                >
                  <TranslatedText
                    text={workTitle}
                    className="text-xs text-slate-400 truncate block"
                  />
                  <TranslatedText
                    text={audioTitle}
                    className="text-sm text-white font-medium truncate block"
                  />
                </button>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onTrackChange("prev")}
                    disabled={!hasPrev}
                    className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="p-2 rounded-full bg-pink-500 hover:bg-pink-400 text-white transition-colors"
                  >
                    {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => onTrackChange("next")}
                    disabled={!hasNext}
                    className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={toggleMute}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 accent-pink-500"
                  />
                </div>

                {/* Subtitle toggle */}
                <button
                  onClick={() => setShowSubtitles(!showSubtitles)}
                  className={`p-1.5 rounded-md transition-colors ${
                    showSubtitles
                      ? "text-pink-400 hover:text-pink-300"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {showSubtitles ? (
                    <Subtitles className="w-4 h-4" />
                  ) : (
                    <SubtitlesOff className="w-4 h-4" />
                  )}
                </button>

                {/* Expand */}
                <button
                  onClick={() => setExpanded(true)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Expand player"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Seek bar */}
              <div className="flex items-center gap-2 px-4 mt-2">
                <span className="text-[10px] text-slate-500 w-8 text-right">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1 accent-pink-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 w-8">{formatTime(duration)}</span>
              </div>

              {/* Subtitles */}
              {showSubtitles && (
                <div className="flex-1 overflow-hidden mx-4 mb-2 mt-1 rounded-lg bg-slate-800/50">
                  {loading ? (
                    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                      Loading subtitles...
                    </div>
                  ) : activeCues.length > 0 ? (
                    <SubtitleDisplay cues={activeCues} currentTime={currentTime} englishOnly />
                  ) : (
                    <WhisperGenerator audioUrl={audioUrl} onCuesGenerated={setWhisperCues} />
                  )}
                </div>
              )}

              {!showSubtitles && <div className="flex-1" />}
            </div>

            {/* Right: Mini Image Slideshow (click to expand) */}
            {showImagePanel && allImages.length > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className="hidden md:flex flex-col w-[140px] border-l border-slate-700/50 bg-slate-800/30 group"
                title="Expand for full artwork view"
              >
                <div className="relative flex-1 overflow-hidden w-full">
                  <img
                    src={currentArt}
                    alt="Artwork"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ChevronUp className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {allImages.length > 1 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/50 rounded text-[9px] text-white font-mono">
                      {imgIndex + 1}/{allImages.length}
                    </div>
                  )}
                </div>
              </button>
            )}

            {/* Toggle image panel button */}
            {allImages.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImagePanel(!showImagePanel);
                }}
                className={`hidden md:flex items-center justify-center w-6 border-l border-slate-700/50 ${
                  showImagePanel ? "bg-slate-800 text-slate-400" : "bg-slate-800/50 text-slate-500"
                } hover:text-white transition-colors`}
                title={showImagePanel ? "Hide artwork" : "Show artwork"}
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
