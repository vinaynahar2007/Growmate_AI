import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { speech } from "../../lib/voiceService.js";
import { useVoice } from "../../hooks/useVoice.js";

const Ctx = createContext(null);

export const SUGGESTIONS = [
  "Ramesh ka khata dikhao.",
  "Pichle 10 din se kaunse regular customers nahi aaye?",
  "Kin customers ka ₹1,000 se zyada baki hai?",
  "Milk ka stock kitna hai?",
  "Aaj kitni sale hui?",
  "Rahul ne 500 ka saman udhaar liya.",
  "Rahul ka naya khata banao, father name Vikash hai.",
];

export function CopilotProvider({ children, onDataChanged }) {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [input, setInput] = useState("");

  const idRef = useRef(0);
  const lastSentRef = useRef(0);

  // Keep the ref available before useVoice is initialized.
  const sendVoiceRef = useRef(null);

  /*
   * Normal text chat.
   * Defined BEFORE sendVoice because sendVoice uses send().
   */
  const send = useCallback(
    async (rawText) => {
      const text = (rawText ?? input).trim();

      if (!text || busy) return null;

      speech.prime();

      // Rate-limit requests to one per second.
      const now = Date.now();
      if (now - lastSentRef.current < 1000) return null;
      lastSentRef.current = now;

      setInput("");

      const userMsg = {
        id: ++idRef.current,
        role: "user",
        content: text,
        at: Date.now(),
      };

      setMessages((m) => [...m, userMsg]);
      setBusy(true);

      try {
        const history = messages
          .slice(-8)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const res = await api.chat(text, history);

        const aiMsg = {
          id: ++idRef.current,
          role: "assistant",
          content: res.reply,
          meta: res,
          at: Date.now(),
        };

        setMessages((m) => [...m, aiMsg]);

        if (autoVoice) {
          voice.speak(res.reply);
        }

        const mutating = (res.tool_calls || []).find(
          (t) =>
            ["add_transaction", "create_or_update_customer_khata"].includes(
              t.name
            ) &&
            !t?.result?.error
        );

        if (mutating) {
          onDataChanged?.(mutating.name);
        }

        return aiMsg;
      } catch (err) {
        const message =
          err?.message || "Something went wrong. Please try again.";

        const aiMsg = {
          id: ++idRef.current,
          role: "assistant",
          content: message,
          meta: {
            mode: "error",
            error: message,
          },
          at: Date.now(),
        };

        setMessages((m) => [...m, aiMsg]);

        return aiMsg;
      } finally {
        setBusy(false);
      }
    },
    [input, busy, messages, autoVoice, onDataChanged]
  );

  /*
   * Voice input hook.
   */
  const voice = useVoice({
    onResult: (text) => setInput(text),
    onBlob: (blob) => sendVoiceRef.current?.(blob),
  });

  /*
   * Voice -> Whisper -> AI -> TTS.
   * Defined AFTER send because it uses send() as fallback.
   */
  const sendVoice = useCallback(
    async (blob) => {
      if (!blob || busy) return null;

      speech.prime();

      const history = messages
        .slice(-8)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      setBusy(true);

      try {
        const data = await speech.voiceKhata(blob, history);

        if (data && data.reply) {
          setInput("");

          const userMsg = {
            id: ++idRef.current,
            role: "user",
            content: data.transcript || "🎤 (voice request)",
            at: Date.now(),
          };

          const aiMsg = {
            id: ++idRef.current,
            role: "assistant",
            content: data.reply,
            meta: {
              mode: data.mode,
              intent: data.intent,
              tool_calls: data.tool_calls || [],
              data: data.data,
              transcript: data.transcript || null,
            },
            at: Date.now(),
          };

          setMessages((m) => [...m, userMsg, aiMsg]);

          if (autoVoice) {
            const played = await speech
              .playBase64(data.audio_b64)
              .catch(() => null);

            if (!played && data.reply) {
              voice.speak(data.reply);
            }
          }

          const mutating = (data.tool_calls || []).find(
            (t) =>
              ["add_transaction", "create_or_update_customer_khata"].includes(
                t.name
              ) &&
              !t?.result?.error
          );

          if (mutating) {
            onDataChanged?.(mutating.name);
          }

          return aiMsg;
        }

        // Fallback:
        // audio -> browser/backend transcription -> normal chat
        const text = await speech.transcribe(blob).catch(() => "");

        setBusy(false);

        if (!text) {
          const aiMsg = {
            id: ++idRef.current,
            role: "assistant",
            content: "Kuch samajh nahi aaya — dobara boliye.",
            meta: {
              mode: "error",
              error: "no_transcript",
            },
            at: Date.now(),
          };

          setMessages((m) => [...m, aiMsg]);

          return aiMsg;
        }

        setInput("");

        return send(text);
      } catch (err) {
        const message =
          err?.message || "Something went wrong. Please try again.";

        const aiMsg = {
          id: ++idRef.current,
          role: "assistant",
          content: message,
          meta: {
            mode: "error",
            error: message,
          },
          at: Date.now(),
        };

        setMessages((m) => [...m, aiMsg]);

        return aiMsg;
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, autoVoice, voice, onDataChanged, send]
  );

  sendVoiceRef.current = sendVoice;

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  const value = useMemo(
    () => ({
      messages,
      busy,
      send,
      sendVoice,
      clear,
      input,
      setInput,
      autoVoice,
      setAutoVoice,
      voice,
    }),
    [
      messages,
      busy,
      send,
      sendVoice,
      clear,
      input,
      autoVoice,
      voice,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCopilot = () => useContext(Ctx);