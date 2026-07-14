"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { VttCue } from "./asmr-api";

export interface WhisperProgress {
  status: "downloading" | "loading" | "transcribing" | "translating" | "done" | "error" | "idle";
  message: string;
  progress?: number; // 0-1
  file?: string;
}

export interface WhisperResult {
  cues: VttCue[]; // with .text (original) and .translatedText (English)
}

// Cache in-memory + IndexedDB for transcribed audio URLs
const memoryCache = new Map<string, WhisperResult>();

function cacheKeyFor(audioUrl: string): string {
  return `whisper-cache:${audioUrl}`;
}

async function readCache(audioUrl: string): Promise<WhisperResult | null> {
  const mem = memoryCache.get(audioUrl);
  if (mem) return mem;

  try {
    const raw = localStorage.getItem(cacheKeyFor(audioUrl));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WhisperResult;
    memoryCache.set(audioUrl, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(audioUrl: string, result: WhisperResult) {
  memoryCache.set(audioUrl, result);
  try {
    localStorage.setItem(cacheKeyFor(audioUrl), JSON.stringify(result));
  } catch {
    // localStorage may be full; ignore
  }
}

// Convert a stream URL into a Float32Array audio at 16kHz mono (Whisper's expected format)
async function fetchAndDecodeAudio(url: string): Promise<Float32Array> {
  // Use proxied URL to avoid CORS issues
  const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(url)}`;

  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();

  // Decode into AudioBuffer
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate: 16000 });
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  // Convert to mono
  let audio: Float32Array;
  if (audioBuffer.numberOfChannels === 1) {
    audio = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    audio = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      audio[i] = (left[i] + right[i]) / 2;
    }
  }

  await ctx.close();
  return audio;
}

// Convert Whisper output chunks into VttCue[]
interface WhisperChunk {
  timestamp: [number, number | null];
  text: string;
}

function chunksToVttCues(
  transcriptionChunks: WhisperChunk[],
  translationChunks: WhisperChunk[]
): VttCue[] {
  const cues: VttCue[] = [];

  transcriptionChunks.forEach((chunk, i) => {
    const start = chunk.timestamp[0] || 0;
    const end = chunk.timestamp[1] ?? start + 3;
    const translated = translationChunks[i]?.text?.trim();

    cues.push({
      id: String(i + 1),
      startTime: start,
      endTime: end,
      text: chunk.text.trim(),
      translatedText: translated,
    });
  });

  return cues;
}

export function useWhisper() {
  const [progress, setProgress] = useState<WhisperProgress>({
    status: "idle",
    message: "",
  });
  const [result, setResult] = useState<WhisperResult | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Initialize the worker
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const transcribe = useCallback(async (audioUrl: string) => {
    // Check cache first
    const cached = await readCache(audioUrl);
    if (cached) {
      setResult(cached);
      setProgress({ status: "done", message: "Loaded from cache" });
      return cached;
    }

    setResult(null);
    setProgress({ status: "downloading", message: "Downloading audio..." });

    try {
      // 1. Fetch & decode audio
      const audio = await fetchAndDecodeAudio(audioUrl);
      setProgress({
        status: "loading",
        message: "Loading Whisper model (first run downloads ~150MB, then cached)",
        progress: 0,
      });

      // 2. Init worker if not already
      if (!workerRef.current) {
        workerRef.current = new Worker("/whisper-worker.js", { type: "module" });
      }
      const worker = workerRef.current;

      // 3. Set up message handler
      return await new Promise<WhisperResult>((resolve, reject) => {
        const handler = async (event: MessageEvent) => {
          const { type } = event.data;

          if (type === "progress") {
            const p = event.data.data;
            if (p.status === "progress") {
              setProgress({
                status: "loading",
                message: `Downloading ${p.file || "model"}`,
                progress: p.progress / 100,
                file: p.file,
              });
            } else if (p.status === "ready") {
              setProgress({ status: "transcribing", message: "Model loaded, starting transcription..." });
            }
          } else if (type === "status") {
            setProgress({
              status: event.data.status === "transcribing" ? "transcribing" : "loading",
              message:
                event.data.status === "transcribing"
                  ? "Transcribing audio (Japanese)..."
                  : "Processing...",
            });
          } else if (type === "partial") {
            setProgress({ status: "translating", message: "Translating to English..." });
          } else if (type === "complete") {
            worker.removeEventListener("message", handler);
            const cues = chunksToVttCues(
              event.data.transcription.chunks || [],
              event.data.translation.chunks || []
            );
            const finalResult: WhisperResult = { cues };
            await writeCache(audioUrl, finalResult);
            setResult(finalResult);
            setProgress({ status: "done", message: "Done!" });
            resolve(finalResult);
          } else if (type === "error") {
            worker.removeEventListener("message", handler);
            setProgress({ status: "error", message: event.data.error });
            reject(new Error(event.data.error));
          }
        };

        worker.addEventListener("message", handler);
        worker.postMessage({
          type: "transcribe",
          audio,
          language: "japanese",
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgress({ status: "error", message: msg });
      throw err;
    }
  }, []);

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (abortRef.current) abortRef.current.abort();
    setProgress({ status: "idle", message: "" });
  }, []);

  return { transcribe, cancel, progress, result };
}
