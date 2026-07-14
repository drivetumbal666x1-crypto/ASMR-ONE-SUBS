"use client";

import { useWhisper } from "@/lib/use-whisper";
import { Sparkles, Loader2, Download, AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { VttCue } from "@/lib/asmr-api";

interface WhisperGeneratorProps {
  audioUrl: string;
  onCuesGenerated: (cues: VttCue[]) => void;
}

export default function WhisperGenerator({
  audioUrl,
  onCuesGenerated,
}: WhisperGeneratorProps) {
  const { transcribe, cancel, progress, result } = useWhisper();
  const [started, setStarted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);

  // Check WebGPU support
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const gpu = (navigator as unknown as { gpu?: unknown }).gpu;
    setWebgpuAvailable(!!gpu);
  }, []);

  // Reset when audioUrl changes
  useEffect(() => {
    setStarted(false);
    setDismissed(false);
  }, [audioUrl]);

  // Push cues up when they're ready
  useEffect(() => {
    if (result?.cues) {
      onCuesGenerated(result.cues);
    }
  }, [result, onCuesGenerated]);

  const handleGenerate = async () => {
    setStarted(true);
    try {
      await transcribe(audioUrl);
    } catch (err) {
      console.error("Whisper transcription failed:", err);
    }
  };

  if (dismissed) return null;

  // Idle state — show the "Generate" button
  if (!started && progress.status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
        <Sparkles className="w-8 h-8 text-pink-400" />
        <div>
          <p className="text-sm text-slate-200 font-medium">No subtitles available</p>
          <p className="text-xs text-slate-400 mt-1">
            Generate subtitles from audio using AI (Whisper)
          </p>
        </div>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-pink-500 hover:bg-pink-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate Subtitles (JP → EN)
        </button>
        <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
          {webgpuAvailable
            ? "⚡ WebGPU available — fast transcription"
            : "Uses CPU (WASM) — slower, but works everywhere"}
        </p>
        <p className="text-[10px] text-slate-500 max-w-xs">
          First run downloads ~150MB model. Cached for future use. Runs 100% in your browser — no data sent anywhere.
        </p>
      </div>
    );
  }

  // Loading / progress state
  if (progress.status !== "done" && progress.status !== "idle") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
        {progress.status === "error" ? (
          <>
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-300 font-medium">Transcription failed</p>
            <p className="text-xs text-slate-400 max-w-xs break-words">
              {progress.message}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  cancel();
                  setStarted(false);
                }}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-md transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-md transition-colors"
              >
                Dismiss
              </button>
            </div>
          </>
        ) : (
          <>
            {progress.status === "downloading" ? (
              <Download className="w-6 h-6 text-pink-400 animate-pulse" />
            ) : (
              <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
            )}
            <p className="text-sm text-slate-200 font-medium capitalize">
              {progress.status === "loading" && progress.file
                ? `Downloading ${progress.file}`
                : progress.status === "loading"
                  ? "Loading model..."
                  : progress.status === "downloading"
                    ? "Downloading audio..."
                    : progress.status === "transcribing"
                      ? "Transcribing (Japanese)..."
                      : progress.status === "translating"
                        ? "Translating to English..."
                        : progress.message}
            </p>
            {progress.progress !== undefined && progress.progress > 0 && (
              <div className="w-64 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-500 transition-all"
                  style={{ width: `${Math.round(progress.progress * 100)}%` }}
                />
              </div>
            )}
            <p className="text-[10px] text-slate-500 max-w-xs">
              {progress.status === "loading"
                ? "First run only. Model is cached in your browser after this."
                : progress.status === "transcribing" || progress.status === "translating"
                  ? "This may take 1-5 minutes depending on audio length and your device"
                  : ""}
            </p>
            <button
              onClick={() => {
                cancel();
                setStarted(false);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 underline mt-2 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </>
        )}
      </div>
    );
  }

  // Done — cues will be rendered by parent through onCuesGenerated
  return null;
}
