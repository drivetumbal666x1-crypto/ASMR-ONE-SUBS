// Whisper transcription worker using CDN import
// Runs in a separate thread so the UI doesn't freeze

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

env.allowLocalModels = false;
env.useBrowserCache = true;

class WhisperPipeline {
  static task = "automatic-speech-recognition";
  static model = "onnx-community/whisper-base";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      try {
        this.instance = await pipeline(this.task, this.model, {
          progress_callback,
          dtype: {
            encoder_model: "fp32",
            decoder_model_merged: "q4",
          },
          device: "webgpu",
        });
      } catch (err) {
        console.warn("WebGPU failed, falling back to WASM:", err);
        this.instance = await pipeline(this.task, this.model, {
          progress_callback,
          dtype: "q8",
        });
      }
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event) => {
  const { type, audio, language } = event.data;

  if (type === "transcribe") {
    try {
      const transcriber = await WhisperPipeline.getInstance((progress) => {
        self.postMessage({ type: "progress", data: progress });
      });

      self.postMessage({ type: "status", status: "transcribing" });

      // Transcribe in original language (Japanese)
      const transcription = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: language || "japanese",
        task: "transcribe",
        return_timestamps: true,
      });

      self.postMessage({ type: "partial", transcription });

      // Translate to English (Whisper does this natively!)
      const translation = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: language || "japanese",
        task: "translate",
        return_timestamps: true,
      });

      self.postMessage({ type: "complete", transcription, translation });
    } catch (error) {
      self.postMessage({
        type: "error",
        error: error.message || String(error),
      });
    }
  }
});
