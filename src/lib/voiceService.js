/**
 * GrowMate AI speech service.
 *
 * Two tiers:
 *   1. Backend service — OpenAI Whisper STT (`POST /api/audio/transcribe`) and
 *      neural TTS (`POST /api/audio/speak`) served by the FastAPI backend when
 *      OPENAI_API_KEY is configured.
 *   2. Browser fallback — Web Speech API + speechSynthesis (works offline / demo).
 *
 * The backend is preferred automatically; if it is unreachable or not enabled,
 * callers fall back to the browser APIs. This module never throws — it resolves
 * with `""` / `null` so the caller can decide what to do.
 */
import { API_URL } from "./api.js";

const MAX_SECONDS = 25;
const TIMEOUT_MS = 30000;

// Smallest valid silent WAV — used to "unlock" audio playback on first gesture so
// later TTS (both backend mp3 and speechSynthesis) is allowed by autoplay rules.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export const speech = {
  backendAvailable: false,

  /** Probe the backend health endpoint and remember whether speech is enabled. */
  async check() {
    try {
      const res = await fetch(`${API_URL}/api/health`, {
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("health");
      const h = await res.json();
      this.backendAvailable = Boolean(h.speech_enabled);
    } catch {
      this.backendAvailable = false;
    }
    return this.backendAvailable;
  },

  /** Call once inside a user gesture (mic click / send) to unlock autoplay. */
  prime() {
    if (this._unlocked || typeof Audio === "undefined") return;
    try {
      const el = this._audioEl || (this._audioEl = new Audio());
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && p.then) p.then(() => el.pause()).catch(() => {});
      this._unlocked = true;
    } catch {
      /* ignore */
    }
  },

  // ------------------------------------------------------------ recording
  querySupported() {
    return Boolean(
      typeof window !== "undefined" &&
        window.navigator?.mediaDevices?.getUserMedia &&
        window.MediaRecorder
    );
  },

  _recorderMime() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (const t of types) {
      if (window.MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  },

  /**
   * Record audio from the microphone. Resolves with a Blob when stopped
   * (user taps stop, or `maxSeconds` elapses). Call `speech.stopRecording()`
   * to finish early. Never throws on its own.
   */
  record({ maxSeconds = MAX_SECONDS } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.querySupported()) {
        reject(new Error("Recording not supported in this browser."));
        return;
      }
      const chunks = [];
      let recorder = null;
      let settled = false;

      const finish = (blob) => {
        if (settled) return;
        settled = true;
        resolve(blob);
      };
      const stop = () => {
        if (recorder && recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {
            /* ignore */
          }
        }
      };
      this._stopRecording = stop;

      navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .then((stream) => {
          recorder = new MediaRecorder(stream, { mimeType: this._recorderMime() });
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size) chunks.push(e.data);
          };
          recorder.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            this._stopRecording = null;
            const type = recorder.mimeType || "audio/webm";
            finish(new Blob(chunks, { type }));
          };
          recorder.onerror = () => {
            stream.getTracks().forEach((t) => t.stop());
            this._stopRecording = null;
            reject(new Error("Recording failed."));
          };
          recorder.start();
          setTimeout(stop, maxSeconds * 1000);
        })
        .catch((err) => {
          this._stopRecording = null;
          reject(err);
        });
    });
  },

  stopRecording() {
    if (this._stopRecording) {
      this._stopRecording();
      this._stopRecording = null;
    }
  },

  // ------------------------------------------------------------ STT
  /**
   * Transcribe a Blob with the backend Whisper service.
   * Returns the transcript, or `""` when unavailable/failed.
   */
  async transcribe(blob) {
    if (!this.backendAvailable || !blob) return "";
    try {
      const form = new FormData();
      form.append("file", blob, "voice.webm");
      const res = await fetch(`${API_URL}/api/audio/transcribe`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) return "";
      const data = await res.json();
      return (data.text || "").trim();
    } catch {
      return "";
    }
  },

  // ------------------------------------------------------------ TTS
  /**
   * Synthesize speech with the backend TTS service and play it.
   * Returns the Audio element on success, or `null` when unavailable/failed
   * (caller then falls back to speechSynthesis).
   */
  async speak(text) {
    if (!text || !this.backendAvailable) return null;
    try {
      const res = await fetch(`${API_URL}/api/audio/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 1000) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = this._audioEl || (this._audioEl = new Audio());
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (this._currentAudio === audio) this._currentAudio = null;
      };
      audio.src = url;
      this._currentAudio = audio;
      await audio.play();
      return audio;
    } catch {
      if (this._currentAudio?.src) {
        URL.revokeObjectURL(this._currentAudio.src);
        this._currentAudio = null;
      }
      return null;
    }
  },

  /** Stop any in-flight backend TTS playback. */
  stopSpeaking() {
    const audio = this._currentAudio;
    if (audio) {
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
      if (audio.src && audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
      audio.removeAttribute("src");
      this._currentAudio = null;
    }
  },

  // ------------------------------------------------------------ one-shot voice khata
  /**
   * One-shot voice khata — a single HTTP call does STT (Whisper), runs the AI
   * agent (which stores the customer/khata in the database) and returns the
   * spoken reply as base64 mp3 (`audio_b64`), so no extra /speak round-trip is
   * needed. Resolves with the parsed JSON, or `null` when unavailable.
   */
  async voiceKhata(blob, history = []) {
    if (!this.backendAvailable || !blob) return null;
    try {
      const form = new FormData();
      form.append("file", blob, "voice.webm");
      form.append("history", JSON.stringify(history || []));
      const res = await fetch(`${API_URL}/api/audio/khata-voice`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000),
        cache: "no-store",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  /** Play a base64-encoded mp3 reply through the shared Audio element. */
  async playBase64(b64, mime = "audio/mpeg") {
    if (!b64) return null;
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const audio = this._audioEl || (this._audioEl = new Audio());
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (this._currentAudio === audio) this._currentAudio = null;
      };
      audio.src = url;
      this._currentAudio = audio;
      await audio.play();
      return audio;
    } catch {
      if (this._currentAudio?.src?.startsWith("blob:")) {
        URL.revokeObjectURL(this._currentAudio.src);
      }
      this._currentAudio = null;
      return null;
    }
  },
};