import { Bot, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { PageHeader } from "../ui.jsx";
import { useCopilot, SUGGESTIONS } from "./CopilotContext.jsx";
import CopilotInput from "./CopilotInput.jsx";
import ResponseCard, { UserBubble } from "./ResponseCard.jsx";

export default function Copilot({ aiMode }) {
  const { messages, busy, clear, send } = useCopilot();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  return (
    <div className="fade-up flex flex-col" style={{ minHeight: "calc(100vh - 120px)" }}>
      <PageHeader
        eyebrow="AI Copilot"
        title="Talk to your business"
        subtitle={aiMode === "openai" ? "Powered by the OpenAI agent with tool calling." : "Demo AI mode — rule-based intents over real shop data. Add OPENAI_API_KEY to enable the full agent."}
        actions={
          <>
            <span className={`badge ${aiMode === "openai" ? "badge-purple" : "badge-amber"}`}><Sparkles size={11} /> {aiMode === "openai" ? "OpenAI agent" : "Demo AI mode"}</span>
            {messages.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clear}><Trash2 size={13} /> Clear</button>}
          </>
        }
      />

      <div className="flex-1 space-y-4 mb-5">
        {messages.length === 0 && (
          <div className="card p-8 text-center">
            <div className="icon-tile icon-tile-solid mx-auto mb-4" style={{ width: 56, height: 56 }}><Bot size={24} /></div>
            <h3 className="font-bold text-lg">Namaste! Main GrowMate hoon.</h3>
            <p className="text-sm text-[var(--muted)] mt-1 max-w-md mx-auto">Hindi, English ya English me poochho — khata, stock, sales, udhaar, sab kuch. Try one:</p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn btn-ghost btn-sm" onClick={() => send(s)} style={{ fontWeight: 500 }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (m.role === "user" ? <UserBubble key={m.id} content={m.content} /> : <ResponseCard key={m.id} message={m} />))}
        {busy && (
          <div className="card p-4 flex items-center gap-3">
            <div className="icon-tile" style={{ width: 34, height: 34 }}><Bot size={15} /></div>
            <div className="typing"><span /><span /><span /></div>
            <span className="text-xs text-[var(--muted)]">Understanding → selecting tool → retrieving shop data…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 pt-3 pb-1" style={{ background: "linear-gradient(to top, var(--bg) 70%, transparent)", zIndex: 5 }}>
        <CopilotInput showSuggestions={false} autoFocus />
      </div>
    </div>
  );
}
