import { useCallback, useEffect, useRef, useState } from "react";
import { speech } from "../lib/voiceService.js";

const SpeechRecognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Voice input + spoken replies.
 *
 * Recording path:
 *   1. Backend speech service (OpenAI Whisper STT + neural TTS) when the FastAPI
 *      backend reports `speech_enabled` and the browser supports MediaRecorder.
 *   2. Browser Web Speech API (Chrome/Edge) as a fallback — same behaviour as
 *      before, so demo mode keeps working with no key.
 *
 * Returns a stable API: { supported, ttsSupported, listening, interim, error,
 * backendReady, start, stop, toggle, speak, stopSpeaking }.
 */
export function useVoice({ onResult, onBlob, lang = "hi-IN" } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);
  const [backendReady, setBackendReady] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onBlobRef = useRef(onBlob);
  onBlobRef.current = onBlob;

  const recSupported = Boolean(SpeechRecognition);
  const mediaSupported = speech.querySupported();
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const recRef = useRef(null); // browser recognition instance (fallback path)
  const recordingRef = useRef(false); // true while the backend recorder is live

  const supported = mediaSupported || recSupported;

  // ---- backend capability check ----
  useEffect(() => {
    let active = true;
    speech
      .check()
      .then((ok) => {
        if (active) setBackendReady(ok);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // ---- browser recognition instance (fallback path) ----
  useEffect(() => {
    if (!recSupported) return;
    const rec = new SpeechRecognition();
    rec.lang = lang; // hi-IN handles Hindi + English + Hinglish well
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setError(null);
      setInterim("");
    };
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim("");
        onResultRef.current?.(finalText.trim(), true);
      }
    };
    rec.onerror = (e) => {
      const map = {
        "not-allowed": "Microphone permission denied.",
        "no-speech": "No speech detected. Try again.",
        network: "Speech service unavailable (network).",
        "audio-capture": "No microphone found.",
      };
      setError(map[e.error] || `Voice error: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [recSupported, lang]);

  const startBrowserRec = useCallback(() => {
    try {
      recRef.current?.start();
    } catch {
      /* already started */
    }
  }, []);

  // ---- start: backend-first recording, browser STT as fallback ----
  const start = useCallback(() => {
    setError(null);
    speech.prime(); // unlock autoplay for later TTS on this gesture
    window.speechSynthesis?.cancel();
    speech.stopSpeaking();

    const useBackend = backendReady && mediaSupported;
    if (useBackend) {
      let cancelled = false;
      recordingRef.current = true;
      setListening(true);
      setInterim("");
      speech
        .record({ maxSeconds: 25 })
        .then(async (blob) => {
          if (cancelled) return;
          if (onBlobRef.current) {
            onBlobRef.current(blob); // one-shot voice khata handled by the caller
            return;
          }
          const text = await speech.transcribe(blob);
          if (cancelled) return;
          if (text) {
            onResultRef.current?.(text, true);
          } else {
            setError("Kuch samajh nahi aaya — dobara boliye.");
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err?.message || "Recording failed.");
          if (recSupported) startBrowserRec();
        })
        .finally(() => {
          if (!cancelled) {
            recordingRef.current = false;
            setListening(false);
          }
        });
    } else if (recSupported) {
      startBrowserRec();
    } else {
      setError("Voice not supported in this browser (use Chrome/Edge).");
    }
  }, [backendReady, mediaSupported, recSupported, startBrowserRec]);

  const stop = useCallback(() => {
    if (recordingRef.current) {
      speech.stopRecording();
    } else {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, stop, start]);

  // ---- speak: backend TTS first, speechSynthesis fallback ----
  const speak = useCallback(
    async (text) => {
      if (!text) return null;
      const backendAudio = await speech.speak(text).catch(() => null);
      if (backendAudio) return backendAudio;
      if (!ttsSupported) return null;
      try {
        window.speechSynthesis?.cancel();
        const clean = text.replace(/[•*_#]/g, "").replace(/₹/g, " rupees ");
        const utter = new SpeechSynthesisUtterance(clean);
        const voices = window.speechSynthesis.getVoices();
        const hindi =
          voices.find((v) => /hi-IN/i.test(v.lang)) || voices.find((v) => /en-IN/i.test(v.lang));
        if (hindi) utter.voice = hindi;
        utter.lang = hindi?.lang || "en-IN";
        utter.rate = 1;
        window.speechSynthesis.speak(utter);
      } catch {
        /* ignore */
      }
      return null;
    },
    [ttsSupported]
  );

  const stopSpeaking = useCallback(() => {
    speech.stopSpeaking();
    window.speechSynthesis?.cancel();
  }, []);

  return {
    supported,
    ttsSupported,
    listening,
    interim,
    error,
    backendReady,
    start,
    stop,
    toggle,
    speak,
    stopSpeaking,
  };
}
