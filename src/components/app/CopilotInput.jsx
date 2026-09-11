import { Mic, MicOff, SendHorizonal, Volume2, VolumeX } from "lucide-react";
import { useCopilot, SUGGESTIONS } from "./CopilotContext.jsx";

export default function CopilotInput({ compact = false, showSuggestions = true, autoFocus = false }) {
  const { input, setInput, send, busy, voice, autoVoice, setAutoVoice } = useCopilot();

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div>
      <div className="card glow flex items-center gap-3 p-2.5 pl-3" style={{ background: "var(--card-2)" }}>
        <button
          type="button"
          onClick={voice.toggle}
          disabled={!voice.supported}
          title={voice.supported ? (voice.listening ? "Stop listening" : "Speak (Hindi / English / English)") : "Voice not supported in this browser"}
          className={`icon-tile icon-tile-solid shrink-0 ${voice.listening ? "mic-listening" : ""}`}
          style={{ width: 44, height: 44, cursor: voice.supported ? "pointer" : "not-allowed", opacity: voice.supported ? 1 : 0.5 }}
        >
          {voice.supported ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-[var(--muted)]">{voice.listening ? "Listening… bolo" : "Ask your Copilot"}</div>
          <input
            data-copilot-input
            className="w-full bg-transparent outline-none text-[15px] font-medium placeholder:text-[var(--muted-2)]" maxLength="2000"
            placeholder="Ramesh ka khata dikhao."
            value={voice.listening && voice.interim ? voice.interim : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
            autoFocus={autoFocus}
          />
        </div>
        <button type="button" onClick={() => send()} disabled={busy || !input.trim()} className="btn btn-ghost shrink-0" style={{ padding: 10, borderRadius: 12 }} aria-label="Send">
          <SendHorizonal size={18} />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <div className="text-sm text-[var(--muted)] flex items-center gap-2">
          <span className={voice.supported ? "dot-pulse" : "w-2 h-2 rounded-full bg-[var(--muted-2)]"} />
          {!voice.supported
            ? "Voice: not supported in this browser (use Chrome/Edge)"
            : voice.backendReady
              ? "AI voice: Hindi/English (Whisper + TTS)"
              : "Voice: browser mode (Chrome/Edge)"}
          {busy && voice.backendReady && <span className="text-[var(--accent)]">· Processing voice khata…</span>}
          {voice.error && <span className="text-[var(--red)]">· {voice.error}</span>}
        </div>
        <button type="button" onClick={() => { if (autoVoice) voice.stopSpeaking(); setAutoVoice(!autoVoice); }} className="btn btn-ghost btn-sm" style={{ borderRadius: 999 }} disabled={!voice.ttsSupported}>
          {autoVoice ? <Volume2 size={14} /> : <VolumeX size={14} />}
          Auto voice {autoVoice ? "ON" : "OFF"}
        </button>
      </div>

      {showSuggestions && (
        <div className="flex flex-wrap gap-2 mt-3">
          {(compact ? SUGGESTIONS.slice(0, 4) : SUGGESTIONS).map((s) => (
            <button key={s} type="button" onClick={() => send(s)} disabled={busy} className="btn btn-ghost btn-sm" style={{ fontSize: 12, fontWeight: 500, padding: "6px 10px" }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
